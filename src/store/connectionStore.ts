import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/tauri";

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
}

interface ConnectionState {
  connections: Connection[];
  activeConnectionId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadConnections: () => Promise<void>;
  addConnection: (connection: Omit<Connection, "id">) => Promise<void>;
  updateConnection: (id: string, connection: Partial<Connection>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  setActiveConnection: (id: string | null) => void;
  testConnection: (config: Omit<Connection, "id">) => Promise<boolean>;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,
      isLoading: false,
      error: null,

      loadConnections: async () => {
        set({ isLoading: true, error: null });
        try {
          const connections = await invoke<Connection[]>("get_connections");
          set({ connections, isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Failed to load connections",
            isLoading: false 
          });
        }
      },

      addConnection: async (connection) => {
        set({ isLoading: true, error: null });
        try {
          await invoke("save_connection", { config: connection });
          await get().loadConnections();
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Failed to save connection",
            isLoading: false 
          });
          throw error;
        }
      },

      updateConnection: async (id, connection) => {
        set({ isLoading: true, error: null });
        try {
          const existing = get().connections.find(c => c.id === id);
          if (!existing) throw new Error("Connection not found");
          
          const updated = { ...existing, ...connection };
          await invoke("save_connection", { config: updated });
          await get().loadConnections();
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Failed to update connection",
            isLoading: false 
          });
          throw error;
        }
      },

      deleteConnection: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await invoke("delete_connection", { id });
          
          const newConnections = get().connections.filter(c => c.id !== id);
          set({ 
            connections: newConnections,
            activeConnectionId: get().activeConnectionId === id 
              ? (newConnections[0]?.id || null)
              : get().activeConnectionId,
            isLoading: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : "Failed to delete connection",
            isLoading: false 
          });
          throw error;
        }
      },

      setActiveConnection: (id) => {
        set({ activeConnectionId: id });
      },

      testConnection: async (config) => {
        try {
          await invoke("test_connection", { config });
          return true;
        } catch (error) {
          return false;
        }
      },
    }),
    {
      name: "mysql-client-connections",
      partialize: (state) => ({ 
        connections: state.connections,
        activeConnectionId: state.activeConnectionId 
      }),
    }
  )
);
