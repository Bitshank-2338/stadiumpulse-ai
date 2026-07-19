/**
 * StadiumPulse AI — single authoritative store.
 * Original StadiumPulse AI code. Owned by the orchestrator.
 *
 * Every screen and the 3D scene consume this store. Deterministic logic only:
 * AI never mutates state directly — results enter through explicit actions.
 */

import { create } from 'zustand';
import type {
  AccessibilityPreferences,
  ActiveRoute,
  AiStatus,
  Announcement,
  AuditAction,
  AuditEntry,
  CrowdMap,
  FacilityState,
  Incident,
  IncidentExtraction,
  IncidentStatus,
  ScenarioId,
  SimulationState,
  SustainabilityState,
  TeamId,
  TransportState,
} from '../types/domain';
import { DEFAULT_PREFERENCES, HIGH_RISK_CATEGORIES } from '../types/domain';
import { nextId } from '../lib/ids';

export interface StadiumStore {
  simulation: SimulationState;
  crowd: CrowdMap;
  facilities: Record<string, FacilityState>;
  incidents: Incident[];
  routes: ActiveRoute[];
  transport: TransportState;
  sustainability: SustainabilityState;
  announcements: Announcement[];
  userPreferences: AccessibilityPreferences;
  auditLog: AuditEntry[];
  aiStatus: AiStatus;

  // -- incidents ------------------------------------------------------------
  reportIncident: (
    extraction: IncidentExtraction,
    meta: {
      rawReport: string;
      reportedBy: Incident['reportedBy'];
      provenance: Incident['provenance'];
    },
  ) => Incident;
  acknowledgeIncident: (id: string, actor: string) => void;
  assignTeam: (id: string, team: TeamId, actor: string) => void;
  approveAction: (id: string, actionIndex: number, actor: string) => void;
  rejectAction: (id: string, actionIndex: number, actor: string) => void;
  addIncidentNote: (id: string, actor: string, text: string) => void;
  resolveIncident: (id: string, actor: string) => boolean;
  reopenIncident: (id: string, actor: string) => boolean;

  // -- routes ---------------------------------------------------------------
  setRoute: (route: ActiveRoute) => void;
  clearRoute: (id: string) => void;

  // -- announcements --------------------------------------------------------
  addAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt' | 'status'>) => Announcement;
  approveAnnouncement: (id: string, actor: string) => void;
  publishAnnouncement: (id: string, actor: string) => boolean;

  // -- environment (set by scenario engine / dev tools) ---------------------
  setCrowd: (crowd: CrowdMap) => void;
  setFacilities: (f: Record<string, FacilityState>) => void;
  setTransport: (t: TransportState) => void;
  setSustainability: (s: SustainabilityState) => void;

  // -- preferences / ai -----------------------------------------------------
  setPreferences: (p: Partial<AccessibilityPreferences>) => void;
  setAiStatus: (s: Partial<AiStatus>) => void;

  // -- scenario lifecycle (effects applied by the scenario engine) ----------
  beginScenario: (id: ScenarioId) => void;
  appendAudit: (actor: string, action: AuditAction, detail: string, refId?: string) => void;

  /** Full reset to a provided baseline snapshot (scenario engine supplies it). */
  restoreBaseline: (baseline: BaselineSnapshot) => void;
}

export interface BaselineSnapshot {
  simulation: SimulationState;
  crowd: CrowdMap;
  facilities: Record<string, FacilityState>;
  incidents: Incident[];
  routes: ActiveRoute[];
  transport: TransportState;
  sustainability: SustainabilityState;
  announcements: Announcement[];
}

const INITIAL_SIMULATION: SimulationState = {
  activeScenario: 'normal_match_day',
  clockMinutes: 0,
  sequence: 0,
};

const INITIAL_TRANSPORT: TransportState = {
  load: {},
  metroStatus: 'normal',
  shuttleStatus: 'normal',
  advisories: [],
};

const INITIAL_SUSTAINABILITY: SustainabilityState = {
  wasteFill: {},
  energyUseKwh: 0,
  waterUseLiters: 0,
  alerts: [],
};

const INITIAL_AI_STATUS: AiStatus = {
  available: false,
  lastProvenance: null,
  lastLatencyMs: null,
  lastError: null,
};

function isHighRisk(incident: Incident): boolean {
  return HIGH_RISK_CATEGORIES.includes(incident.category);
}

const RESOLVABLE_FROM: readonly IncidentStatus[] = [
  'acknowledged',
  'assigned',
  'in_progress',
];

export const useStadiumStore = create<StadiumStore>((set, get) => {
  const audit = (
    actor: string,
    action: AuditAction,
    detail: string,
    refId?: string,
  ): void => {
    const entry: AuditEntry = {
      id: nextId('audit'),
      at: Date.now(),
      actor,
      action,
      detail,
      ...(refId !== undefined ? { refId } : {}),
    };
    set((s) => ({ auditLog: [...s.auditLog, entry] }));
  };

  const patchIncident = (
    id: string,
    patch: (i: Incident) => Partial<Incident>,
  ): void => {
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === id ? { ...i, ...patch(i), updatedAt: Date.now() } : i,
      ),
    }));
  };

  return {
    simulation: INITIAL_SIMULATION,
    crowd: {},
    facilities: {},
    incidents: [],
    routes: [],
    transport: INITIAL_TRANSPORT,
    sustainability: INITIAL_SUSTAINABILITY,
    announcements: [],
    userPreferences: DEFAULT_PREFERENCES,
    auditLog: [],
    aiStatus: INITIAL_AI_STATUS,

    reportIncident: (extraction, meta) => {
      const now = Date.now();
      const incident: Incident = {
        ...extraction,
        // High-risk categories ALWAYS require human approval regardless of AI.
        requiresHumanApproval:
          extraction.requiresHumanApproval ||
          HIGH_RISK_CATEGORIES.includes(extraction.category),
        id: nextId('inc'),
        status: 'reported',
        reportedBy: meta.reportedBy,
        rawReport: meta.rawReport,
        createdAt: now,
        updatedAt: now,
        notes: [],
        provenance: meta.provenance,
        approvedActions: [],
        rejectedActions: [],
      };
      set((s) => ({ incidents: [...s.incidents, incident] }));
      audit(meta.reportedBy, 'incident_reported', incident.summary, incident.id);
      return incident;
    },

    acknowledgeIncident: (id, actor) => {
      patchIncident(id, () => ({ status: 'acknowledged' }));
      audit(actor, 'incident_acknowledged', `Acknowledged ${id}`, id);
    },

    assignTeam: (id, team, actor) => {
      patchIncident(id, () => ({ status: 'assigned', assignedTeam: team }));
      audit(actor, 'incident_assigned', `Assigned ${team} to ${id}`, id);
    },

    approveAction: (id, actionIndex, actor) => {
      patchIncident(id, (i) => ({
        status: i.status === 'reported' ? 'acknowledged' : i.status,
        approvedActions: i.approvedActions.includes(actionIndex)
          ? i.approvedActions
          : [...i.approvedActions, actionIndex],
        rejectedActions: i.rejectedActions.filter((n) => n !== actionIndex),
      }));
      const action = get().incidents.find((i) => i.id === id)?.recommendedActions[actionIndex];
      audit(actor, 'incident_action_approved', `Approved: ${action ?? actionIndex}`, id);
    },

    rejectAction: (id, actionIndex, actor) => {
      patchIncident(id, (i) => ({
        rejectedActions: i.rejectedActions.includes(actionIndex)
          ? i.rejectedActions
          : [...i.rejectedActions, actionIndex],
        approvedActions: i.approvedActions.filter((n) => n !== actionIndex),
      }));
      const action = get().incidents.find((i) => i.id === id)?.recommendedActions[actionIndex];
      audit(actor, 'incident_action_rejected', `Rejected: ${action ?? actionIndex}`, id);
    },

    addIncidentNote: (id, actor, text) => {
      patchIncident(id, (i) => ({
        notes: [...i.notes, { at: Date.now(), author: actor, text }],
      }));
      audit(actor, 'incident_note_added', text, id);
    },

    resolveIncident: (id, actor) => {
      const incident = get().incidents.find((i) => i.id === id);
      if (!incident) return false;
      // Human-approval enforcement: high-risk incidents may only resolve after
      // an operator has acknowledged/assigned them; never straight from
      // 'reported' and never by AI (AI has no resolve path at all).
      if (!RESOLVABLE_FROM.includes(incident.status)) return false;
      if (isHighRisk(incident) && incident.approvedActions.length === 0 && incident.notes.length === 0) {
        // Require at least one explicit operator decision on high-risk incidents.
        return false;
      }
      patchIncident(id, () => ({ status: 'resolved' }));
      audit(actor, 'incident_resolved', `Resolved ${id}`, id);
      return true;
    },

    reopenIncident: (id, actor) => {
      const incident = get().incidents.find((i) => i.id === id);
      if (!incident || incident.status !== 'resolved') return false;
      patchIncident(id, () => ({ status: 'acknowledged' }));
      audit(actor, 'incident_reopened', `Reopened ${id}`, id);
      return true;
    },

    setRoute: (route) => {
      set((s) => ({
        routes: [...s.routes.filter((r) => r.id !== route.id), route],
      }));
      audit(route.ownerRole, 'route_requested', `${route.request.fromNodeId} → ${route.request.toNodeId} (${route.request.mode})`, route.id);
    },

    clearRoute: (id) => {
      set((s) => ({ routes: s.routes.filter((r) => r.id !== id) }));
    },

    addAnnouncement: (a) => {
      const announcement: Announcement = {
        ...a,
        id: nextId('ann'),
        createdAt: Date.now(),
        status: 'draft',
      };
      set((s) => ({ announcements: [...s.announcements, announcement] }));
      audit('operator', 'announcement_generated', announcement.title, announcement.id);
      return announcement;
    },

    approveAnnouncement: (id, actor) => {
      set((s) => ({
        announcements: s.announcements.map((a) =>
          a.id === id && a.status === 'draft' ? { ...a, status: 'approved' as const } : a,
        ),
      }));
      audit(actor, 'announcement_approved', `Approved ${id}`, id);
    },

    publishAnnouncement: (id, actor) => {
      const a = get().announcements.find((x) => x.id === id);
      // Publishing requires prior explicit approval.
      if (!a || a.status !== 'approved') return false;
      set((s) => ({
        announcements: s.announcements.map((x) =>
          x.id === id ? { ...x, status: 'published' as const, publishedAt: Date.now() } : x,
        ),
      }));
      audit(actor, 'announcement_published', a.title, id);
      return true;
    },

    setCrowd: (crowd) => set({ crowd }),
    setFacilities: (facilities) => set({ facilities }),
    setTransport: (transport) => set({ transport }),
    setSustainability: (sustainability) => set({ sustainability }),

    setPreferences: (p) =>
      set((s) => ({ userPreferences: { ...s.userPreferences, ...p } })),

    setAiStatus: (patch) =>
      set((s) => ({ aiStatus: { ...s.aiStatus, ...patch } })),

    beginScenario: (id) => {
      set((s) => ({
        simulation: { ...s.simulation, activeScenario: id },
      }));
      audit('operator', 'scenario_activated', id);
    },

    appendAudit: (actor, action, detail, refId) => audit(actor, action, detail, refId),

    restoreBaseline: (baseline) => {
      set({
        simulation: baseline.simulation,
        crowd: baseline.crowd,
        facilities: baseline.facilities,
        incidents: baseline.incidents,
        routes: baseline.routes,
        transport: baseline.transport,
        sustainability: baseline.sustainability,
        announcements: baseline.announcements,
      });
      audit('operator', 'scenario_reset', 'Baseline state restored');
    },
  };
});
