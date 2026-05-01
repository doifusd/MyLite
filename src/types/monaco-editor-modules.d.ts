declare module 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution' {
  // Side-effect module: registers SQL language support with Monaco
}

declare module 'monaco-editor/esm/vs/editor/editor.worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
