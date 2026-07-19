/** StadiumPulse AI — Operations Command Center composition root. */
import { AnnouncementCenter, AuditLog, EnvironmentPanel } from './communication-panels';
import { HealthSummary, SituationBriefPanel } from './overview-panels';
import { IncidentQueue } from './incident-panels';

export function CommandCenter() {
  return (
    <>
      <HealthSummary />
      <SituationBriefPanel />
      <IncidentQueue />
      <AnnouncementCenter />
      <EnvironmentPanel />
      <AuditLog />
    </>
  );
}
