import { create } from "zustand";
import * as entities from "../lib/entities";
import type { Entity, EntityType, Relationship } from "../lib/entities";

type EntityStore = {
  entities: Record<string, Entity>;
  relationships: Relationship[];
  currentEntityId: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setCurrentEntity: (entityId: string | null) => void;
  getCurrentEntity: () => Entity | null;
  getEntity: (entityId: string) => Entity | null;
  getEntitiesByType: (type: EntityType) => Entity[];
  getRelationshipsForEntity: (entityId: string) => Relationship[];
  createEntity: (
    type: EntityType,
    name: string,
    properties?: Record<string, unknown>,
  ) => Promise<Entity>;
  updateEntity: (
    entityId: string,
    updates: { name?: string; properties?: Record<string, unknown> },
  ) => Promise<void>;
  deleteEntity: (entityId: string) => Promise<void>;
  createRelationship: (
    type: entities.RelationshipType,
    subjectId: string,
    objectId: string,
    properties?: Record<string, unknown>,
    evidenceIds?: string[],
  ) => Promise<Relationship>;
  deleteRelationship: (relationshipId: string) => Promise<void>;
  searchEntities: (query: string) => Promise<Entity[]>;
};

export const useEntityStore = create<EntityStore>((set, get) => ({
  entities: {},
  relationships: [],
  currentEntityId: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    try {
      set({ isLoading: true });

      // Initialize tables
      await entities.initEntityTables();

      // Load all entities
      const allEntities = await entities.getAllEntities();
      const entitiesMap: Record<string, Entity> = {};
      for (const entity of allEntities) {
        entitiesMap[entity.id] = entity;
      }

      // Load all relationships
      const allRelationships = await entities.getAllRelationships();

      set({
        entities: entitiesMap,
        relationships: allRelationships,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Failed to initialize entity store:", error);
      set({ isLoading: false });
    }
  },

  setCurrentEntity: (entityId) => {
    set({ currentEntityId: entityId });
  },

  getCurrentEntity: () => {
    const state = get();
    if (!state.currentEntityId) return null;
    return state.entities[state.currentEntityId] || null;
  },

  getEntity: (entityId) => {
    return get().entities[entityId] || null;
  },

  getEntitiesByType: (type) => {
    return Object.values(get().entities).filter((e) => e.type === type);
  },

  getRelationshipsForEntity: (entityId) => {
    return get().relationships.filter(
      (r) => r.subject_id === entityId || r.object_id === entityId,
    );
  },

  createEntity: async (type, name, properties = {}) => {
    const entity = await entities.createEntity(type, name, properties);

    set((state) => ({
      entities: { ...state.entities, [entity.id]: entity },
    }));

    return entity;
  },

  updateEntity: async (entityId, updates) => {
    await entities.updateEntity(entityId, updates);

    set((state) => ({
      entities: {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          ...updates,
          updated_at: Date.now(),
        },
      },
    }));
  },

  deleteEntity: async (entityId) => {
    await entities.deleteEntity(entityId);

    set((state) => {
      const rest = { ...state.entities };
      delete rest[entityId];
      return {
        entities: rest,
        relationships: state.relationships.filter(
          (r) => r.subject_id !== entityId && r.object_id !== entityId,
        ),
        currentEntityId:
          state.currentEntityId === entityId ? null : state.currentEntityId,
      };
    });
  },

  createRelationship: async (
    type,
    subjectId,
    objectId,
    properties = {},
    evidenceIds = [],
  ) => {
    const relationship = await entities.createRelationship(
      type,
      subjectId,
      objectId,
      properties,
      evidenceIds,
    );

    set((state) => ({
      relationships: [...state.relationships, relationship],
    }));

    return relationship;
  },

  deleteRelationship: async (relationshipId) => {
    await entities.deleteRelationship(relationshipId);

    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== relationshipId),
    }));
  },

  searchEntities: async (query) => {
    return entities.searchEntities(query);
  },
}));
