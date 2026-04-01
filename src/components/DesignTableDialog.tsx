import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/tauri';
import {
    Check,
    Copy,
    Key,
    Loader2,
    Plus,
    Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColumnInfo {
    name: string;
    data_type: string;
    is_nullable: boolean;
    default_value?: string;
    is_primary_key: boolean;
    is_auto_increment: boolean;
    comment?: string;
    character_set?: string;
    collation?: string;
    max_length?: number;
    numeric_precision?: number;
    numeric_scale?: number;
}

interface EditableColumn extends ColumnInfo {
    /** True for columns added in this session that don't yet exist in DB */
    isNew?: boolean;
    /** Original DB name; used to detect renames → CHANGE COLUMN */
    originalName?: string;
}

interface IndexInfo {
    name: string;
    is_unique: boolean;
    is_primary: boolean;
    columns: string[];
    index_type: string;
}

interface EditableIndex extends IndexInfo {
    /** True for indexes added in this session */
    isNew?: boolean;
    /** Original DB name; used to detect renames */
    originalName?: string;
}

interface TableInfo {
    name: string;
    schema: string;
    engine?: string;
    comment?: string;
    create_sql?: string;
    collation?: string;
    auto_increment?: number;
    row_format?: string;
    avg_row_length?: number;
    create_options?: string;
    columns: ColumnInfo[];
    indexes: IndexInfo[];
}

interface CharsetInfo {
    charset: string;
    description?: string;
    default_collation?: string;
}

interface CollationInfo {
    collation: string;
    charset?: string;
}

interface DesignTableDialogProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string;
    database: string;
    tableName: string;
    onRefresh?: () => void;
}

const MYSQL_TYPES = [
    'varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext',
    'int', 'tinyint', 'smallint', 'mediumint', 'bigint',
    'decimal', 'float', 'double',
    'date', 'datetime', 'timestamp', 'time', 'year',
    'json', 'blob', 'mediumblob', 'longblob', 'binary', 'varbinary',
    'enum', 'set',
];

const MYSQL_ENGINES = ['InnoDB', 'MyISAM', 'MEMORY', 'CSV', 'ARCHIVE', 'BLACKHOLE', 'FEDERATED'];

const MYSQL_ROW_FORMATS = ['DEFAULT', 'DYNAMIC', 'FIXED', 'COMPRESSED', 'REDUNDANT', 'COMPACT'];
const STATS_OPTS = [{ label: 'DEFAULT', value: '' }, { label: '0', value: '0' }, { label: '1', value: '1' }];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCreateOptions(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!raw) return result;
    const re = /(\w+)=(?:'([^']*)'|(\S+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        result[m[1].toUpperCase()] = m[2] ?? m[3];
    }
    return result;
}

function buildColumnDef(col: EditableColumn): string {
    const name = `\`${col.name}\``;
    const type = col.data_type.toUpperCase();

    let typeFull = type;
    if (col.numeric_precision != null && col.numeric_scale != null && ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE'].includes(type)) {
        typeFull = `${type}(${col.numeric_precision},${col.numeric_scale})`;
    } else if (col.max_length != null && ['VARCHAR', 'CHAR', 'VARBINARY', 'BINARY'].includes(type)) {
        typeFull = `${type}(${col.max_length})`;
    }

    const charset = col.character_set ? ` CHARACTER SET ${col.character_set}` : '';
    const collate = col.collation ? ` COLLATE ${col.collation}` : '';
    const nullable = col.is_nullable ? ' NULL' : ' NOT NULL';
    const defVal = col.default_value != null && col.default_value !== ''
        ? ` DEFAULT '${col.default_value.replace(/'/g, "\\'")}'`
        : '';
    const ai = col.is_auto_increment ? ' AUTO_INCREMENT' : '';
    const comment = col.comment ? ` COMMENT '${col.comment.replace(/'/g, "\\'")}'` : '';

    return `${name} ${typeFull}${charset}${collate}${nullable}${defVal}${ai}${comment}`;
}

function columnsEqual(a: ColumnInfo, b: EditableColumn): boolean {
    return (
        a.name === b.name &&
        a.data_type === b.data_type &&
        a.is_nullable === b.is_nullable &&
        (a.default_value ?? '') === (b.default_value ?? '') &&
        a.is_auto_increment === b.is_auto_increment &&
        (a.comment ?? '') === (b.comment ?? '') &&
        (a.character_set ?? '') === (b.character_set ?? '') &&
        (a.collation ?? '') === (b.collation ?? '') &&
        (a.max_length ?? null) === (b.max_length ?? null) &&
        (a.numeric_precision ?? null) === (b.numeric_precision ?? null) &&
        (a.numeric_scale ?? null) === (b.numeric_scale ?? null)
    );
}

// ─── Index helpers ────────────────────────────────────────────────────────────

function indexesEqual(a: IndexInfo, b: EditableIndex): boolean {
    return (
        a.name === b.name &&
        a.is_unique === b.is_unique &&
        a.index_type.toUpperCase() === (b.index_type || 'BTREE').toUpperCase() &&
        a.columns.length === b.columns.length &&
        a.columns.every((c, i) => c === b.columns[i])
    );
}

/** Derives a display kind string from index flags + type. */
function indexKind(idx: Pick<EditableIndex, 'is_unique' | 'index_type'>): string {
    const t = (idx.index_type ?? '').toUpperCase();
    if (t === 'FULLTEXT') return 'fulltext';
    if (t === 'SPATIAL') return 'spatial';
    return idx.is_unique ? 'unique' : 'normal';
}

function buildCreateIndex(idx: EditableIndex, tableRef: string): string {
    const cols = idx.columns.filter(Boolean).map(c => `\`${c.trim()}\``).join(', ');
    const kind = indexKind(idx);
    if (kind === 'fulltext') {
        return `CREATE FULLTEXT INDEX \`${idx.name}\` ON ${tableRef} (${cols})`;
    }
    if (kind === 'spatial') {
        return `CREATE SPATIAL INDEX \`${idx.name}\` ON ${tableRef} (${cols})`;
    }
    const unique = kind === 'unique' ? 'UNIQUE ' : '';
    const method = idx.index_type && !['FULLTEXT', 'SPATIAL'].includes(idx.index_type.toUpperCase())
        ? ` USING ${idx.index_type.toUpperCase()}` : '';
    return `CREATE ${unique}INDEX \`${idx.name}\` ON ${tableRef} (${cols})${method}`;
}

// ─── Alter SQL Generator ──────────────────────────────────────────────────────

interface TableOptionsExtra {
    autoIncrement: string;
    rowFormat: string;
    keyBlockSize: string;
    minRows: string;
    maxRows: string;
    encryption: boolean;
    statsAutoRecalc: string;
    statsPersistent: string;
    statsSamplePages: string;
    dataDirectory: string;
    indexDirectory: string;
    tablespace: string;
}

function generateAlterStatements(
    tableInfo: TableInfo,
    editableColumns: EditableColumn[],
    deletedColumns: string[],
    editableIndexes: EditableIndex[],
    deletedIndexes: string[],
    editableEngine: string,
    editableCollation: string,
    editableComment: string,
    database: string,
    tableName: string,
    opts?: TableOptionsExtra,
): string[] {
    const stmts: string[] = [];
    const tableRef = `\`${database}\`.\`${tableName}\``;

    // 1. Dropped columns
    for (const colName of deletedColumns) {
        stmts.push(`ALTER TABLE ${tableRef} DROP COLUMN \`${colName}\``);
    }

    // 2. Modified or new columns
    for (const col of editableColumns) {
        if (!col.name.trim()) continue;

        if (col.isNew) {
            stmts.push(`ALTER TABLE ${tableRef} ADD COLUMN ${buildColumnDef(col)}`);
        } else {
            const originalName = col.originalName ?? col.name;
            const original = tableInfo.columns.find(c => c.name === originalName);
            if (!original) continue;

            const renamed = originalName !== col.name;
            if (renamed) {
                stmts.push(`ALTER TABLE ${tableRef} CHANGE COLUMN \`${originalName}\` ${buildColumnDef(col)}`);
            } else if (!columnsEqual(original, col)) {
                stmts.push(`ALTER TABLE ${tableRef} MODIFY COLUMN ${buildColumnDef(col)}`);
            }
        }
    }

    // 3. Engine change
    if (editableEngine && editableEngine !== (tableInfo.engine ?? '')) {
        stmts.push(`ALTER TABLE ${tableRef} ENGINE = ${editableEngine}`);
    }

    // 4. Collation change
    const origCollation = tableInfo.collation ?? '';
    if (editableCollation && editableCollation !== origCollation) {
        const charset = editableCollation.split('_')[0];
        stmts.push(`ALTER TABLE ${tableRef} CONVERT TO CHARACTER SET ${charset} COLLATE ${editableCollation}`);
    }

    // 5. Comment change
    const origComment = tableInfo.comment ?? '';
    if (editableComment !== origComment) {
        stmts.push(`ALTER TABLE ${tableRef} COMMENT = '${editableComment.replace(/'/g, "\\'")}'`);
    }

    // 6. Dropped indexes
    for (const idxName of deletedIndexes) {
        stmts.push(`ALTER TABLE ${tableRef} DROP INDEX \`${idxName}\``);
    }

    // 7. New or modified indexes
    for (const idx of editableIndexes) {
        if (!idx.name.trim() || idx.columns.filter(Boolean).length === 0) continue;
        if (idx.isNew) {
            stmts.push(buildCreateIndex(idx, tableRef));
        } else {
            const originalName = idx.originalName ?? idx.name;
            const original = tableInfo.indexes.find(i => i.name === originalName);
            if (!original) continue;
            if (!indexesEqual(original, idx)) {
                stmts.push(`ALTER TABLE ${tableRef} DROP INDEX \`${originalName}\``);
                stmts.push(buildCreateIndex(idx, tableRef));
            }
        }
    }

    // 8. Extra table options
    if (opts) {
        const origOpts = parseCreateOptions(tableInfo.create_options ?? '');

        if (opts.autoIncrement !== '' && opts.autoIncrement !== String(tableInfo.auto_increment ?? '')) {
            stmts.push(`ALTER TABLE ${tableRef} AUTO_INCREMENT = ${parseInt(opts.autoIncrement, 10)}`);
        }
        if (opts.rowFormat && opts.rowFormat !== 'DEFAULT' && opts.rowFormat !== (tableInfo.row_format ?? '')) {
            stmts.push(`ALTER TABLE ${tableRef} ROW_FORMAT = ${opts.rowFormat}`);
        }
        if (opts.keyBlockSize !== (origOpts['KEY_BLOCK_SIZE'] ?? '') && opts.keyBlockSize !== '') {
            stmts.push(`ALTER TABLE ${tableRef} KEY_BLOCK_SIZE = ${parseInt(opts.keyBlockSize, 10)}`);
        }
        if (opts.minRows !== (origOpts['MIN_ROWS'] ?? '') && opts.minRows !== '') {
            stmts.push(`ALTER TABLE ${tableRef} MIN_ROWS = ${parseInt(opts.minRows, 10)}`);
        }
        if (opts.maxRows !== (origOpts['MAX_ROWS'] ?? '') && opts.maxRows !== '') {
            stmts.push(`ALTER TABLE ${tableRef} MAX_ROWS = ${parseInt(opts.maxRows, 10)}`);
        }
        const origEncryption = (origOpts['ENCRYPTION'] ?? 'N') === 'Y';
        if (opts.encryption !== origEncryption) {
            stmts.push(`ALTER TABLE ${tableRef} ENCRYPTION = '${opts.encryption ? 'Y' : 'N'}'`);
        }
        if (opts.statsAutoRecalc !== (origOpts['STATS_AUTO_RECALC'] ?? '') && opts.statsAutoRecalc !== '') {
            stmts.push(`ALTER TABLE ${tableRef} STATS_AUTO_RECALC = ${opts.statsAutoRecalc}`);
        }
        if (opts.statsPersistent !== (origOpts['STATS_PERSISTENT'] ?? '') && opts.statsPersistent !== '') {
            stmts.push(`ALTER TABLE ${tableRef} STATS_PERSISTENT = ${opts.statsPersistent}`);
        }
        if (opts.statsSamplePages !== (origOpts['STATS_SAMPLE_PAGES'] ?? '') && opts.statsSamplePages !== '') {
            stmts.push(`ALTER TABLE ${tableRef} STATS_SAMPLE_PAGES = ${parseInt(opts.statsSamplePages, 10)}`);
        }
        if (opts.tablespace !== '' && opts.tablespace !== (origOpts['TABLESPACE'] ?? '')) {
            stmts.push(`ALTER TABLE ${tableRef} TABLESPACE \`${opts.tablespace}\``);
        }
    }

    return stmts;
}

// ─── Inline cell input ────────────────────────────────────────────────────────

const CellInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: 'text' | 'number';
    className?: string;
    list?: string;
}> = ({ value, onChange, placeholder, type = 'text', className, list }) => (
    <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        list={list}
        spellCheck={false}
        className={cn(
            'w-full bg-transparent font-mono text-xs text-gray-800 dark:text-gray-200',
            'outline-none px-1 py-0.5 rounded border border-transparent',
            'hover:border-gray-300 dark:hover:border-[#3a3a4a]',
            'focus:border-blue-400 dark:focus:border-blue-500',
            'focus:bg-blue-50 dark:focus:bg-[#1a3150]',
            'placeholder:text-gray-400 dark:placeholder:text-gray-600',
            className,
        )}
    />
);

type TabId = 'fields' | 'indexes' | 'options' | 'comment' | 'sql_preview';

const TABS: { id: TabId; label: string }[] = [
    { id: 'fields', label: 'Fields' },
    { id: 'indexes', label: 'Indexes' },
    { id: 'options', label: 'Options' },
    { id: 'comment', label: 'Comment' },
    { id: 'sql_preview', label: 'SQL Preview' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const DesignTableDialog: React.FC<DesignTableDialogProps> = ({
    isOpen,
    onClose,
    connectionId,
    database,
    tableName,
    onRefresh,
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('fields');
    const [copied, setCopied] = useState(false);
    const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);

    // ── Editable state ──
    const [editableColumns, setEditableColumns] = useState<EditableColumn[]>([]);
    const [deletedColumns, setDeletedColumns] = useState<string[]>([]);
    const [editableIndexes, setEditableIndexes] = useState<EditableIndex[]>([]);
    const [deletedIndexes, setDeletedIndexes] = useState<string[]>([]);
    const [editableEngine, setEditableEngine] = useState('');
    const [editableCollation, setEditableCollation] = useState('');
    const [editableComment, setEditableComment] = useState('');
    // ── Extra table options ──
    const [editableCharset, setEditableCharset] = useState('');
    const [editableAutoIncrement, setEditableAutoIncrement] = useState('');
    const [editableTablespace, setEditableTablespace] = useState('');
    const [editableDataDirectory, setEditableDataDirectory] = useState('');
    const [editableIndexDirectory, setEditableIndexDirectory] = useState('');
    const [editableMinRows, setEditableMinRows] = useState('');
    const [editableMaxRows, setEditableMaxRows] = useState('');
    const [editableKeyBlockSize, setEditableKeyBlockSize] = useState('');
    const [editableRowFormat, setEditableRowFormat] = useState('');
    const [editableStatsAutoRecalc, setEditableStatsAutoRecalc] = useState('');
    const [editableStatsPersistent, setEditableStatsPersistent] = useState('');
    const [editableStatsSamplePages, setEditableStatsSamplePages] = useState('');
    const [editableEncryption, setEditableEncryption] = useState(false);

    // ── Selection ──
    const [selectedIndexIndex, setSelectedIndexIndex] = useState<number | null>(null);

    // ── Charset / collation lists ──
    const [charsets, setCharsets] = useState<CharsetInfo[]>([]);
    const [collations, setCollations] = useState<CollationInfo[]>([]);

    // ── Derived: pending changes ──
    const pendingStatements = useMemo(() => {
        if (!tableInfo) return [];
        const opts: TableOptionsExtra = {
            autoIncrement: editableAutoIncrement,
            rowFormat: editableRowFormat,
            keyBlockSize: editableKeyBlockSize,
            minRows: editableMinRows,
            maxRows: editableMaxRows,
            encryption: editableEncryption,
            statsAutoRecalc: editableStatsAutoRecalc,
            statsPersistent: editableStatsPersistent,
            statsSamplePages: editableStatsSamplePages,
            dataDirectory: editableDataDirectory,
            indexDirectory: editableIndexDirectory,
            tablespace: editableTablespace,
        };
        return [
            ...generateAlterStatements(tableInfo, editableColumns, deletedColumns, editableIndexes, deletedIndexes, editableEngine, editableCollation, editableComment, database, tableName, opts),
        ];
    }, [tableInfo, editableColumns, deletedColumns, editableIndexes, deletedIndexes, editableEngine, editableCollation, editableComment, database, tableName, editableAutoIncrement, editableRowFormat, editableKeyBlockSize, editableMinRows, editableMaxRows, editableEncryption, editableStatsAutoRecalc, editableStatsPersistent, editableStatsSamplePages, editableDataDirectory, editableIndexDirectory, editableTablespace]);

    const hasChanges = pendingStatements.length > 0;

    // ── Lifecycle ──
    useEffect(() => {
        if (isOpen) {
            setActiveTab('fields');
            setSelectedFieldIndex(null);
            setSaveError(null);
            fetchTableInfo();
            fetchCharsets();
        } else {
            setTableInfo(null);
            setError(null);
            setSaveError(null);
            resetEditableState(null);
        }
    }, [isOpen, connectionId, database, tableName]);

    // ── Fetch ──
    const fetchTableInfo = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await invoke<TableInfo>('get_table_info', {
                connectionId,
                database,
                table: tableName,
            });
            setTableInfo(result);
            resetEditableState(result);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    const fetchCharsets = async () => {
        try {
            const result = await invoke<CharsetInfo[]>('get_charsets', { connectionId });
            setCharsets(result);
        } catch {
            // charsets are optional
        }
    };

    const fetchCollationsForCharset = async (charset: string) => {
        if (!charset) { setCollations([]); return; }
        try {
            const result = await invoke<CollationInfo[]>('get_collations', { connectionId, charset });
            setCollations(result);
        } catch {
            setCollations([]);
        }
    };

    // ── Init editable state ──
    const resetEditableState = (info: TableInfo | null) => {
        if (!info) {
            setEditableColumns([]);
            setDeletedColumns([]);
            setEditableIndexes([]);
            setDeletedIndexes([]);
            setEditableEngine('');
            setEditableCollation('');
            setEditableComment('');
            setEditableCharset('');
            setEditableAutoIncrement('');
            setEditableTablespace('');
            setEditableDataDirectory('');
            setEditableIndexDirectory('');
            setEditableMinRows('');
            setEditableMaxRows('');
            setEditableKeyBlockSize('');
            setEditableRowFormat('');
            setEditableStatsAutoRecalc('');
            setEditableStatsPersistent('');
            setEditableStatsSamplePages('');
            setEditableEncryption(false);
            return;
        }
        setEditableColumns(info.columns.map(c => ({ ...c, originalName: c.name })));
        setDeletedColumns([]);
        // exclude primary key index from editable indexes
        setEditableIndexes(info.indexes.filter(i => !i.is_primary).map(i => ({ ...i, originalName: i.name })));
        setDeletedIndexes([]);
        setEditableEngine(info.engine ?? '');
        setEditableCollation(info.collation ?? '');
        setEditableComment(info.comment ?? '');
        // Extra options from create_options + direct fields
        const parsedOpts = parseCreateOptions(info.create_options ?? '');
        const derivedCharset = (info.collation ?? '').split('_')[0];
        setEditableCharset(derivedCharset);
        if (derivedCharset) fetchCollationsForCharset(derivedCharset);
        setEditableAutoIncrement(info.auto_increment != null ? String(info.auto_increment) : '');
        setEditableRowFormat(info.row_format ?? '');
        setEditableKeyBlockSize(parsedOpts['KEY_BLOCK_SIZE'] ?? '');
        setEditableMinRows(parsedOpts['MIN_ROWS'] ?? '');
        setEditableMaxRows(parsedOpts['MAX_ROWS'] ?? '');
        setEditableEncryption((parsedOpts['ENCRYPTION'] ?? 'N') === 'Y');
        setEditableStatsAutoRecalc(parsedOpts['STATS_AUTO_RECALC'] ?? '');
        setEditableStatsPersistent(parsedOpts['STATS_PERSISTENT'] ?? '');
        setEditableStatsSamplePages(parsedOpts['STATS_SAMPLE_PAGES'] ?? '');
        setEditableDataDirectory(parsedOpts['DATA_DIRECTORY'] ?? '');
        setEditableIndexDirectory(parsedOpts['INDEX_DIRECTORY'] ?? '');
        setEditableTablespace('');
    };

    // ── Column update helpers ──
    const updateEditableColumn = (idx: number, field: keyof EditableColumn, value: unknown) => {
        setEditableColumns(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    };

    const handleAddField = () => {
        const newCol: EditableColumn = {
            name: '',
            data_type: 'varchar',
            is_nullable: true,
            is_primary_key: false,
            is_auto_increment: false,
            max_length: 255,
            isNew: true,
        };
        setEditableColumns(prev => [...prev, newCol]);
        setSelectedFieldIndex(editableColumns.length);
    };

    const handleDeleteField = () => {
        if (selectedFieldIndex === null) return;
        const col = editableColumns[selectedFieldIndex];
        if (!col.isNew && col.originalName) {
            setDeletedColumns(prev => [...prev, col.originalName!]);
        }
        setEditableColumns(prev => prev.filter((_, i) => i !== selectedFieldIndex));
        setSelectedFieldIndex(null);
    };

    // ── Index helpers ──
    const updateEditableIndex = (i: number, field: keyof EditableIndex, value: unknown) => {
        setEditableIndexes(prev => prev.map((idx, j) => j === i ? { ...idx, [field]: value } : idx));
    };

    const handleAddIndex = () => {
        const newIdx: EditableIndex = {
            name: '',
            is_unique: false,
            is_primary: false,
            columns: [],
            index_type: 'BTREE',
            isNew: true,
        };
        setEditableIndexes(prev => [...prev, newIdx]);
        setSelectedIndexIndex(editableIndexes.length);
    };

    const handleDeleteIndex = () => {
        if (selectedIndexIndex === null) return;
        const idx = editableIndexes[selectedIndexIndex];
        if (!idx.isNew && idx.originalName) {
            setDeletedIndexes(prev => [...prev, idx.originalName!]);
        }
        setEditableIndexes(prev => prev.filter((_, i) => i !== selectedIndexIndex));
        setSelectedIndexIndex(null);
    };

    // ── Save ──
    const handleSave = async () => {
        if (!hasChanges || saving) return;
        setSaving(true);
        setSaveError(null);
        try {
            for (const sql of pendingStatements) {
                await invoke('execute_query', { connectionId, database, sql });
            }
            onRefresh?.();
            await fetchTableInfo();
        } catch (err: any) {
            setSaveError(err.toString());
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (!hasChanges) {
            onClose();
            return;
        }
        resetEditableState(tableInfo);
        setSaveError(null);
    };

    // ── Copy helpers ──
    const handleCopyPending = () => {
        const text = pendingStatements.join(';\n') + (pendingStatements.length ? ';' : '');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyDdl = () => {
        if (tableInfo?.create_sql) {
            navigator.clipboard.writeText(tableInfo.create_sql);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // ─── Tab renders ──────────────────────────────────────────────────────────

    const renderFields = () => {
        if (!tableInfo) return null;
        return (
            <div className="flex flex-col h-full overflow-hidden">
                {/* Type datalist for autocomplete */}
                <datalist id="mysql-types">
                    {MYSQL_TYPES.map(t => <option key={t} value={t} />)}
                </datalist>

                {/* Column table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-[#2d2d3a] text-gray-600 dark:text-gray-300 text-xs sticky top-0 z-10">
                                <th className="text-left px-3 py-2 font-medium w-8 border-r border-gray-300 dark:border-[#3a3a4a]">&nbsp;</th>
                                <th className="text-left px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] min-w-[140px]">Name</th>
                                <th className="text-left px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] min-w-[110px]">Type</th>
                                <th className="text-left px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] w-[80px]">Length</th>
                                <th className="text-left px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] w-[80px]">Decimals</th>
                                <th className="text-center px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] w-[80px]">Not Null</th>
                                <th className="text-center px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] w-[50px]">Key</th>
                                <th className="text-left px-3 py-2 font-medium min-w-[160px]">Comment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editableColumns.map((col, idx) => (
                                <tr
                                    key={idx}
                                    className={cn(
                                        'border-b border-gray-200 dark:border-[#2a2a38] cursor-pointer transition-colors',
                                        selectedFieldIndex === idx
                                            ? 'bg-blue-100 dark:bg-[#1e4d7b] hover:bg-blue-100 dark:hover:bg-[#1e4d7b]'
                                            : idx % 2 === 0
                                                ? 'bg-white dark:bg-[#1e1e2e] hover:bg-gray-50 dark:hover:bg-[#252535]'
                                                : 'bg-gray-50 dark:bg-[#22222f] hover:bg-gray-100 dark:hover:bg-[#252535]'
                                    )}
                                    onClick={() => setSelectedFieldIndex(idx)}
                                >
                                    {/* PK icon */}
                                    <td className="px-2 py-1 text-center border-r border-gray-200 dark:border-[#2a2a38] w-8">
                                        {col.is_primary_key && <Key className="h-3.5 w-3.5 text-amber-500 mx-auto" />}
                                    </td>
                                    {/* Name */}
                                    <td className="px-1 py-0.5 border-r border-gray-200 dark:border-[#2a2a38]" onClick={e => e.stopPropagation()}>
                                        <CellInput
                                            value={col.name}
                                            onChange={v => updateEditableColumn(idx, 'name', v)}
                                            placeholder="column_name"
                                        />
                                    </td>
                                    {/* Type */}
                                    <td className="px-1 py-0.5 border-r border-gray-200 dark:border-[#2a2a38]" onClick={e => e.stopPropagation()}>
                                        <CellInput
                                            value={col.data_type}
                                            onChange={v => updateEditableColumn(idx, 'data_type', v)}
                                            placeholder="varchar"
                                            list="mysql-types"
                                            className="text-blue-600 dark:text-blue-300"
                                        />
                                    </td>
                                    {/* Length */}
                                    <td className="px-1 py-0.5 border-r border-gray-200 dark:border-[#2a2a38]" onClick={e => e.stopPropagation()}>
                                        <CellInput
                                            type="number"
                                            value={col.max_length != null ? String(col.max_length) : ''}
                                            onChange={v => updateEditableColumn(idx, 'max_length', v === '' ? undefined : Number(v))}
                                            placeholder="—"
                                            className="text-right text-gray-500 dark:text-gray-400"
                                        />
                                    </td>
                                    {/* Decimals */}
                                    <td className="px-1 py-0.5 border-r border-gray-200 dark:border-[#2a2a38]" onClick={e => e.stopPropagation()}>
                                        <CellInput
                                            type="number"
                                            value={col.numeric_scale != null ? String(col.numeric_scale) : ''}
                                            onChange={v => updateEditableColumn(idx, 'numeric_scale', v === '' ? undefined : Number(v))}
                                            placeholder="—"
                                            className="text-right text-gray-500 dark:text-gray-400"
                                        />
                                    </td>
                                    {/* Not Null */}
                                    <td className="px-3 py-1 border-r border-gray-200 dark:border-[#2a2a38] text-center" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={!col.is_nullable}
                                            onChange={e => updateEditableColumn(idx, 'is_nullable', !e.target.checked)}
                                            className="h-3.5 w-3.5 accent-blue-500 cursor-pointer"
                                        />
                                    </td>
                                    {/* Key */}
                                    <td className="px-3 py-1 border-r border-gray-200 dark:border-[#2a2a38] text-center">
                                        {col.is_primary_key && <Key className="h-3.5 w-3.5 text-amber-500 mx-auto" />}
                                    </td>
                                    {/* Comment */}
                                    <td className="px-1 py-0.5" onClick={e => e.stopPropagation()}>
                                        <CellInput
                                            value={col.comment ?? ''}
                                            onChange={v => updateEditableColumn(idx, 'comment', v)}
                                            placeholder="(comment)"
                                            className="text-gray-500 dark:text-gray-400"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-[#1a1a28] border-t border-gray-200 dark:border-[#2a2a38]">
                    <button
                        onClick={handleAddField}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-[#2a2a38] transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Add Field
                    </button>
                    <button
                        onClick={handleDeleteField}
                        disabled={selectedFieldIndex === null}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-[#2a2a38] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-3 h-3" /> Delete Field
                    </button>
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
                        {editableColumns.length} field{editableColumns.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Field details panel */}
                {selectedFieldIndex !== null && editableColumns[selectedFieldIndex] && (
                    <FieldDetailsPanel
                        col={editableColumns[selectedFieldIndex]}
                        onChange={(field, value) => updateEditableColumn(selectedFieldIndex, field, value)}
                        charsets={charsets}
                        collations={collations}
                        onCharsetChange={cs => {
                            updateEditableColumn(selectedFieldIndex, 'character_set', cs);
                            updateEditableColumn(selectedFieldIndex, 'collation', '');
                            fetchCollationsForCharset(cs);
                        }}
                    />
                )}
            </div>
        );
    };

    const renderIndexes = () => (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-[#2d2d3a] text-gray-600 dark:text-gray-300 text-xs sticky top-0 z-10">
                            <th className="text-left px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] min-w-[160px]">Name</th>
                            <th className="text-left px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] w-[120px]">Type</th>
                            <th className="text-left px-3 py-2 font-medium border-r border-gray-300 dark:border-[#3a3a4a] w-[90px]">Method</th>
                            <th className="text-left px-3 py-2 font-medium min-w-[200px]">Fields</th>
                        </tr>
                    </thead>
                    <tbody>
                        {editableIndexes.map((idx, i) => (
                            <tr
                                key={i}
                                className={cn(
                                    'border-b border-gray-200 dark:border-[#2a2a38] cursor-pointer transition-colors',
                                    selectedIndexIndex === i
                                        ? 'bg-blue-100 dark:bg-[#1e4d7b] hover:bg-blue-100 dark:hover:bg-[#1e4d7b]'
                                        : i % 2 === 0
                                            ? 'bg-white dark:bg-[#1e1e2e] hover:bg-gray-50 dark:hover:bg-[#252535]'
                                            : 'bg-gray-50 dark:bg-[#22222f] hover:bg-gray-100 dark:hover:bg-[#252535]'
                                )}
                                onClick={() => setSelectedIndexIndex(i)}
                            >
                                {/* Name */}
                                <td className="px-1 py-0.5 border-r border-gray-200 dark:border-[#2a2a38]" onClick={e => e.stopPropagation()}>
                                    <CellInput
                                        value={idx.name}
                                        onChange={v => updateEditableIndex(i, 'name', v)}
                                        placeholder="index_name"
                                    />
                                </td>
                                {/* Type: Normal / Unique / Fulltext / Spatial */}
                                <td className="px-1 py-0.5 border-r border-gray-200 dark:border-[#2a2a38]" onClick={e => e.stopPropagation()}>
                                    <select
                                        value={indexKind(idx)}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setEditableIndexes(prev => prev.map((item, j) => j !== i ? item : {
                                                ...item,
                                                is_unique: v === 'unique',
                                                index_type: v === 'fulltext' ? 'FULLTEXT'
                                                    : v === 'spatial' ? 'SPATIAL'
                                                        : item.index_type === 'FULLTEXT' || item.index_type === 'SPATIAL'
                                                            ? 'BTREE'
                                                            : item.index_type,
                                            }));
                                        }}
                                        className="w-full bg-transparent text-xs text-blue-600 dark:text-blue-300 border border-transparent hover:border-gray-300 dark:hover:border-[#3a3a4a] focus:border-blue-400 dark:focus:border-blue-500 focus:bg-blue-50 dark:focus:bg-[#1a3150] rounded px-1 py-0.5 outline-none cursor-pointer font-mono"
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="unique">Unique</option>
                                        <option value="fulltext">Fulltext</option>
                                        <option value="spatial">Spatial</option>
                                    </select>
                                </td>
                                {/* Method: BTREE / HASH — hidden for FULLTEXT/SPATIAL */}
                                <td className="px-1 py-0.5 border-r border-gray-200 dark:border-[#2a2a38]" onClick={e => e.stopPropagation()}>
                                    {indexKind(idx) === 'fulltext' || indexKind(idx) === 'spatial'
                                        ? <span className="px-1 text-xs text-gray-400 dark:text-gray-600">—</span>
                                        : <select
                                            value={idx.index_type || 'BTREE'}
                                            onChange={e => updateEditableIndex(i, 'index_type', e.target.value)}
                                            className="w-full bg-transparent text-xs text-gray-600 dark:text-gray-400 border border-transparent hover:border-gray-300 dark:hover:border-[#3a3a4a] focus:border-blue-400 dark:focus:border-blue-500 focus:bg-blue-50 dark:focus:bg-[#1a3150] rounded px-1 py-0.5 outline-none cursor-pointer font-mono"
                                        >
                                            <option value="BTREE">BTREE</option>
                                            <option value="HASH">HASH</option>
                                        </select>
                                    }
                                </td>
                                {/* Fields (display only, edited in detail panel) */}
                                <td className="px-3 py-1.5 text-xs font-mono">
                                    {idx.columns.length > 0
                                        ? <span className="text-gray-600 dark:text-gray-300">{idx.columns.join(', ')}</span>
                                        : <span className="italic text-gray-400 dark:text-gray-600">click row to select columns</span>}
                                </td>
                            </tr>
                        ))}
                        {editableIndexes.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-xs text-center text-gray-400 dark:text-gray-600">
                                    No indexes — press Add Index to create one
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-[#1a1a28] border-t border-gray-200 dark:border-[#2a2a38]">
                <button
                    onClick={handleAddIndex}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-[#2a2a38] transition-colors"
                >
                    <Plus className="w-3 h-3" /> Add Index
                </button>
                <button
                    onClick={handleDeleteIndex}
                    disabled={selectedIndexIndex === null}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-[#2a2a38] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Trash2 className="w-3 h-3" /> Delete Index
                </button>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
                    {editableIndexes.length} index{editableIndexes.length !== 1 ? 'es' : ''}
                </span>
            </div>

            {/* Index details panel — column selector */}
            {selectedIndexIndex !== null && editableIndexes[selectedIndexIndex] && (
                <IndexDetailsPanel
                    idx={editableIndexes[selectedIndexIndex]}
                    availableColumns={editableColumns.map(c => c.name).filter(Boolean)}
                    onChange={(field, value) => updateEditableIndex(selectedIndexIndex, field, value)}
                />
            )}
        </div>
    );

    const renderOptions = () => {
        if (!tableInfo) return null;

        const selectCls = 'flex-1 h-7 bg-gray-50 dark:bg-[#252535] border border-gray-300 dark:border-[#3a3a4a] rounded px-2 text-xs text-gray-700 dark:text-gray-300 font-mono focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 cursor-pointer';
        const inputCls = 'flex-1 h-7 bg-gray-50 dark:bg-[#252535] border border-gray-300 dark:border-[#3a3a4a] rounded px-2 text-xs text-gray-700 dark:text-gray-300 font-mono focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 placeholder:text-gray-400';
        const readonlyCls = 'flex-1 h-7 bg-gray-100 dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#2a2a38] rounded px-2 flex items-center text-xs text-gray-500 dark:text-gray-500 font-mono';
        const labelCls = 'w-44 text-xs text-gray-500 dark:text-gray-400 shrink-0 text-right pr-2';
        const rowCls = 'flex items-center gap-2';

        const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
            <div className={rowCls}>
                <span className={labelCls}>{label}</span>
                {children}
            </div>
        );

        return (
            <div className="h-full p-6 overflow-auto">
                <div className="max-w-lg space-y-3">
                    {/* Engine */}
                    <Row label="Engine:">
                        <select
                            value={editableEngine}
                            onChange={e => setEditableEngine(e.target.value)}
                            className={selectCls}
                        >
                            {MYSQL_ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
                            {editableEngine && !MYSQL_ENGINES.includes(editableEngine) && (
                                <option value={editableEngine}>{editableEngine}</option>
                            )}
                        </select>
                    </Row>

                    {/* Tablespace */}
                    <Row label="Tablespace:">
                        <input
                            type="text"
                            value={editableTablespace}
                            onChange={e => setEditableTablespace(e.target.value)}
                            placeholder=""
                            className={inputCls}
                        />
                    </Row>

                    {/* Auto Increment */}
                    <Row label="Auto Increment:">
                        <input
                            type="number"
                            min={1}
                            value={editableAutoIncrement}
                            onChange={e => setEditableAutoIncrement(e.target.value)}
                            className={inputCls}
                        />
                    </Row>

                    {/* Default Character Set */}
                    <Row label="Default Character Set:">
                        <select
                            value={editableCharset}
                            onChange={e => {
                                const cs = e.target.value;
                                setEditableCharset(cs);
                                setEditableCollation('');
                                fetchCollationsForCharset(cs);
                            }}
                            className={selectCls}
                        >
                            <option value="">(default)</option>
                            {charsets.map(c => (
                                <option key={c.charset} value={c.charset}>{c.charset}</option>
                            ))}
                            {editableCharset && !charsets.find(c => c.charset === editableCharset) && (
                                <option value={editableCharset}>{editableCharset}</option>
                            )}
                        </select>
                    </Row>

                    {/* Default Collation */}
                    <Row label="Default Collation:">
                        {collations.length > 0 ? (
                            <select
                                value={editableCollation}
                                onChange={e => setEditableCollation(e.target.value)}
                                className={selectCls}
                            >
                                <option value="">(default)</option>
                                {collations.map(c => (
                                    <option key={c.collation} value={c.collation}>{c.collation}</option>
                                ))}
                                {editableCollation && !collations.find(c => c.collation === editableCollation) && (
                                    <option value={editableCollation}>{editableCollation}</option>
                                )}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={editableCollation}
                                onChange={e => setEditableCollation(e.target.value)}
                                placeholder="e.g. utf8mb4_unicode_ci"
                                className={inputCls}
                            />
                        )}
                    </Row>

                    {/* Data Directory */}
                    <Row label="Data Directory:">
                        <input
                            type="text"
                            value={editableDataDirectory}
                            onChange={e => setEditableDataDirectory(e.target.value)}
                            className={inputCls}
                        />
                    </Row>

                    {/* Index Directory */}
                    <Row label="Index Directory:">
                        <input
                            type="text"
                            value={editableIndexDirectory}
                            onChange={e => setEditableIndexDirectory(e.target.value)}
                            className={inputCls}
                        />
                    </Row>

                    {/* Average Row Length (read-only) */}
                    <Row label="Average Row Length:">
                        <div className={readonlyCls}>
                            {tableInfo.avg_row_length ?? 0}
                        </div>
                    </Row>

                    {/* Min Rows */}
                    <Row label="Min Rows:">
                        <input
                            type="number"
                            min={0}
                            value={editableMinRows}
                            onChange={e => setEditableMinRows(e.target.value)}
                            className={inputCls}
                        />
                    </Row>

                    {/* Max Rows */}
                    <Row label="Max Rows:">
                        <input
                            type="number"
                            min={0}
                            value={editableMaxRows}
                            onChange={e => setEditableMaxRows(e.target.value)}
                            className={inputCls}
                        />
                    </Row>

                    {/* Key Block Size */}
                    <Row label="Key Block Size:">
                        <input
                            type="number"
                            min={0}
                            value={editableKeyBlockSize}
                            onChange={e => setEditableKeyBlockSize(e.target.value)}
                            className={inputCls}
                        />
                    </Row>

                    {/* Row Format */}
                    <Row label="Row Format:">
                        <select
                            value={editableRowFormat}
                            onChange={e => setEditableRowFormat(e.target.value)}
                            className={selectCls}
                        >
                            {MYSQL_ROW_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                            {editableRowFormat && !MYSQL_ROW_FORMATS.includes(editableRowFormat) && (
                                <option value={editableRowFormat}>{editableRowFormat}</option>
                            )}
                        </select>
                    </Row>

                    {/* Stats Auto Recalc */}
                    <Row label="Stats Auto Recalc:">
                        <select
                            value={editableStatsAutoRecalc}
                            onChange={e => setEditableStatsAutoRecalc(e.target.value)}
                            className={selectCls}
                        >
                            {STATS_OPTS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                        </select>
                    </Row>

                    {/* Stats Persistent */}
                    <Row label="Stats Persistent:">
                        <select
                            value={editableStatsPersistent}
                            onChange={e => setEditableStatsPersistent(e.target.value)}
                            className={selectCls}
                        >
                            {STATS_OPTS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                        </select>
                    </Row>

                    {/* Stats Sample Pages */}
                    <Row label="Stats Sample Pages:">
                        <input
                            type="number"
                            min={0}
                            value={editableStatsSamplePages}
                            onChange={e => setEditableStatsSamplePages(e.target.value)}
                            className={inputCls}
                        />
                    </Row>

                    {/* Encryption */}
                    <Row label="">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={editableEncryption}
                                onChange={e => setEditableEncryption(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-[#3a3a4a] accent-blue-500"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">Encryption</span>
                        </label>
                    </Row>
                </div>
            </div>
        );
    };

    const renderComment = () => {
        if (!tableInfo) return null;
        return (
            <div className="flex flex-col h-full gap-3 p-6">
                <p className="text-xs text-gray-500 dark:text-gray-400">Table comment</p>
                <textarea
                    value={editableComment}
                    onChange={e => setEditableComment(e.target.value)}
                    placeholder="(no comment)"
                    spellCheck={false}
                    className="flex-1 bg-gray-50 dark:bg-[#252535] border border-gray-300 dark:border-[#3a3a4a] rounded p-3 text-sm text-gray-700 dark:text-gray-300 font-mono resize-none min-h-[80px] focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-600"
                />
            </div>
        );
    };

    const renderSqlPreview = () => {
        const hasPending = pendingStatements.length > 0;
        const ddl = tableInfo?.create_sql ?? '';
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gray-100 dark:bg-[#1a1a28] border-b border-gray-200 dark:border-[#2a2a38]">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {hasPending
                            ? <span className="font-medium text-amber-500">{pendingStatements.length} pending change{pendingStatements.length !== 1 ? 's' : ''}</span>
                            : <span>No pending changes — showing current DDL</span>
                        }
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs text-gray-500 dark:text-gray-400 h-7 hover:text-gray-900 dark:hover:text-white"
                        onClick={hasPending ? handleCopyPending : handleCopyDdl}
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Copied!' : (hasPending ? 'Copy SQL' : 'Copy DDL')}
                    </Button>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                    {hasPending ? (
                        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-amber-700 dark:text-amber-300">
                            {pendingStatements.join(';\n') + ';'}
                        </pre>
                    ) : (
                        <pre className="font-mono text-xs leading-relaxed text-gray-600 whitespace-pre-wrap dark:text-gray-400">
                            {ddl || <span className="text-gray-400 dark:text-gray-600">No DDL available</span>}
                        </pre>
                    )}
                </div>
            </div>
        );
    };

    const renderTabContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center justify-center h-full px-6 text-sm text-center text-red-400">
                    {error}
                </div>
            );
        }
        switch (activeTab) {
            case 'fields': return renderFields();
            case 'indexes': return renderIndexes();
            case 'options': return renderOptions();
            case 'comment': return renderComment();
            case 'sql_preview': return renderSqlPreview();
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent
                    className="max-w-[92vw] w-[92vw] max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#2a2a38] shadow-2xl outline-none focus-visible:outline-none"
                    style={{ fontFamily: 'inherit' }}
                >
                    {/* Title bar */}
                    <DialogHeader className="shrink-0 px-5 py-3 bg-gray-50 dark:bg-[#16161f] border-b border-gray-200 dark:border-[#2a2a38]">
                        <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                            <Key className="w-4 h-4 text-amber-500" />
                            Design Table — <span className="font-mono text-blue-600 dark:text-blue-300">{database}.{tableName}</span>
                            {hasChanges && (
                                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded border border-amber-300 dark:border-amber-700">
                                    {pendingStatements.length} unsaved
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Tab bar */}
                    <div className="shrink-0 flex border-b border-gray-200 dark:border-[#2a2a38] bg-gray-100 dark:bg-[#1a1a28] px-2 pt-1.5">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'px-4 py-1.5 text-xs font-medium rounded-t-md border border-b-0 mr-0.5 transition-colors',
                                    activeTab === tab.id
                                        ? 'bg-white dark:bg-[#1e1e2e] border-gray-300 dark:border-[#3a3a4a] text-gray-900 dark:text-gray-100'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#22222f]'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-hidden">
                        {renderTabContent()}
                    </div>

                    {/* Save error */}
                    {saveError && (
                        <div className="px-4 py-2 font-mono text-xs text-red-600 break-all border-t border-red-200 shrink-0 bg-red-50 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                            {saveError}
                        </div>
                    )}

                    {/* Status bar / footer */}
                    <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-gray-50 dark:bg-[#16161f] border-t border-gray-200 dark:border-[#2a2a38] text-[11px] text-gray-400 dark:text-gray-600">
                        <span>
                            {tableInfo
                                ? `${editableColumns.length} fields · ${editableIndexes.length} indexes · Engine: ${editableEngine || tableInfo.engine || 'N/A'}`
                                : loading ? 'Loading…' : ''}
                            {hasChanges && (
                                <span className="ml-2 text-amber-500">{pendingStatements.length} pending change{pendingStatements.length !== 1 ? 's' : ''}</span>
                            )}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCancel}
                                className="px-3 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2a2a38] transition-colors"
                            >
                                {hasChanges ? 'Reset' : 'Close'}
                            </button>
                            {hasChanges && (
                                <button
                                    onClick={onClose}
                                    className="px-3 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2a2a38] transition-colors"
                                >
                                    Close
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={!hasChanges || saving}
                                className={cn(
                                    'px-4 py-0.5 rounded text-xs font-medium transition-colors',
                                    hasChanges && !saving
                                        ? 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
                                        : 'bg-gray-200 dark:bg-[#2a2a38] text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                )}
                            >
                                {saving
                                    ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
                                    : 'Save'
                                }
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

// ─── Field Details Panel ──────────────────────────────────────────────────────

interface FieldDetailsPanelProps {
    col: EditableColumn;
    onChange: (field: keyof EditableColumn, value: unknown) => void;
    charsets: CharsetInfo[];
    collations: CollationInfo[];
    onCharsetChange: (charset: string) => void;
}

const LABEL_CLS = 'text-[11px] text-gray-500 dark:text-gray-400 w-24 shrink-0';
const INPUT_CLS = cn(
    'flex-1 h-6 bg-gray-50 dark:bg-[#252535] border border-gray-300 dark:border-[#3a3a4a]',
    'rounded px-2 text-[11px] text-gray-700 dark:text-gray-300 font-mono',
    'focus:outline-none focus:border-blue-400 dark:focus:border-blue-500',
    'placeholder:text-gray-400 dark:placeholder:text-gray-600',
);

// ─── Index Details Panel ──────────────────────────────────────────────────────

interface IndexDetailsPanelProps {
    idx: EditableIndex;
    availableColumns: string[];
    onChange: (field: keyof EditableIndex, value: unknown) => void;
}

const IndexDetailsPanel: React.FC<IndexDetailsPanelProps> = ({ idx, availableColumns, onChange }) => {
    const toggleColumn = (colName: string) => {
        const cols = idx.columns.includes(colName)
            ? idx.columns.filter(c => c !== colName)
            : [...idx.columns, colName];
        onChange('columns', cols);
    };

    const moveColumn = (colName: string, dir: -1 | 1) => {
        const cols = [...idx.columns];
        const i = cols.indexOf(colName);
        if (i < 0) return;
        const j = i + dir;
        if (j < 0 || j >= cols.length) return;
        [cols[i], cols[j]] = [cols[j], cols[i]];
        onChange('columns', cols);
    };

    return (
        <div className="shrink-0 border-t border-gray-200 dark:border-[#2a2a38] bg-gray-50 dark:bg-[#16161f] px-4 py-3">
            <div className="flex items-start gap-8">
                {/* Column checkboxes */}
                <div className="flex-1">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 font-medium">Included columns</p>
                    {availableColumns.length === 0 ? (
                        <span className="text-[11px] text-gray-400 dark:text-gray-600 italic">No columns defined yet</span>
                    ) : (
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {availableColumns.map(colName => (
                                <label key={colName} className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={idx.columns.includes(colName)}
                                        onChange={() => toggleColumn(colName)}
                                        className="h-3.5 w-3.5 accent-blue-500"
                                    />
                                    <span className="text-[11px] text-gray-700 dark:text-gray-300 font-mono">{colName}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                {/* Column order (only when composite index) */}
                {idx.columns.length > 1 && (
                    <div className="shrink-0 min-w-[180px]">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 font-medium">Column order</p>
                        <div className="flex flex-col gap-1">
                            {idx.columns.map((col, i) => (
                                <div key={col} className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-400 dark:text-gray-600 w-4 text-right">{i + 1}.</span>
                                    <span className="flex-1 text-[11px] font-mono text-gray-700 dark:text-gray-300 px-1.5 py-0.5 bg-white dark:bg-[#252535] border border-gray-200 dark:border-[#3a3a4a] rounded">{col}</span>
                                    <button
                                        onClick={() => moveColumn(col, -1)}
                                        disabled={i === 0}
                                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 px-0.5"
                                    >↑</button>
                                    <button
                                        onClick={() => moveColumn(col, 1)}
                                        disabled={i === idx.columns.length - 1}
                                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 px-0.5"
                                    >↓</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Field Details Panel ──────────────────────────────────────────────────────

const FieldDetailsPanel: React.FC<FieldDetailsPanelProps> = ({ col, onChange, charsets, collations, onCharsetChange }) => (
    <div className="shrink-0 border-t border-gray-200 dark:border-[#2a2a38] bg-gray-50 dark:bg-[#16161f] px-4 py-3 grid grid-cols-3 gap-x-6 gap-y-2.5">
        {/* Default value */}
        <div className="flex items-center gap-2">
            <span className={LABEL_CLS}>Default</span>
            <input
                type="text"
                value={col.default_value ?? ''}
                onChange={e => onChange('default_value', e.target.value)}
                placeholder="NULL"
                className={INPUT_CLS}
            />
        </div>
        {/* Charset */}
        <div className="flex items-center gap-2">
            <span className={LABEL_CLS}>Charset</span>
            <select
                value={col.character_set ?? ''}
                onChange={e => onCharsetChange(e.target.value)}
                className={cn(INPUT_CLS, 'cursor-pointer')}
            >
                <option value="">Default</option>
                {charsets.map(cs => (
                    <option key={cs.charset} value={cs.charset}>{cs.charset}</option>
                ))}
            </select>
        </div>
        {/* Collation */}
        <div className="flex items-center gap-2">
            <span className={LABEL_CLS}>Collation</span>
            <select
                value={col.collation ?? ''}
                onChange={e => onChange('collation', e.target.value)}
                disabled={!col.character_set}
                className={cn(INPUT_CLS, 'cursor-pointer', !col.character_set && 'opacity-50 cursor-not-allowed')}
            >
                <option value="">Default</option>
                {collations.map(c => (
                    <option key={c.collation} value={c.collation}>{c.collation}</option>
                ))}
            </select>
        </div>
        {/* Auto Increment */}
        <div className="flex items-center gap-2">
            <span className={LABEL_CLS}>Auto Inc.</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                    type="checkbox"
                    checked={col.is_auto_increment}
                    onChange={e => onChange('is_auto_increment', e.target.checked)}
                    className="h-3.5 w-3.5 accent-blue-500"
                />
                <span className="text-[11px] text-gray-600 dark:text-gray-400">{col.is_auto_increment ? 'Yes' : 'No'}</span>
            </label>
        </div>
        {/* Primary Key */}
        <div className="flex items-center gap-2">
            <span className={LABEL_CLS}>Primary Key</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                    type="checkbox"
                    checked={col.is_primary_key}
                    onChange={e => onChange('is_primary_key', e.target.checked)}
                    className="h-3.5 w-3.5 accent-amber-500"
                />
                <span className="text-[11px] text-gray-600 dark:text-gray-400">{col.is_primary_key ? 'Yes' : 'No'}</span>
            </label>
        </div>
        {/* Comment */}
        <div className="flex items-center gap-2">
            <span className={LABEL_CLS}>Comment</span>
            <input
                type="text"
                value={col.comment ?? ''}
                onChange={e => onChange('comment', e.target.value)}
                placeholder="(none)"
                className={INPUT_CLS}
            />
        </div>
    </div>
);

export default DesignTableDialog;
