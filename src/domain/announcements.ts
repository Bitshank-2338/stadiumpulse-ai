/**
 * StadiumPulse AI — deterministic multilingual announcement fallback.
 * Original StadiumPulse AI code.
 *
 * Template-based EN/ES/FR/HI announcements used when Gemini is unavailable.
 * Gemini (Milestone 6) produces richer text validated against the same shape.
 */

import type {
  AnnouncementTranslation,
  Incident,
} from '../types/domain';
import { STADIUM_GRAPH } from '../data/stadium-graph';

const nodeLabel = (id: string): string => STADIUM_GRAPH.nodes[id]?.label ?? id;

interface Template {
  en: string;
  es: string;
  fr: string;
  hi: string;
}

function fill(t: Template, location: string): AnnouncementTranslation[] {
  const sub = (s: string): string => s.replace('{location}', location);
  return [
    { language: 'en', text: sub(t.en) },
    { language: 'es', text: sub(t.es) },
    { language: 'fr', text: sub(t.fr) },
    { language: 'hi', text: sub(t.hi) },
  ];
}

const TEMPLATES: Partial<Record<Incident['category'], Template>> = {
  crowd_congestion: {
    en: 'Please note: heavy congestion near {location}. Please use an alternative entrance and follow staff guidance.',
    es: 'Atención: gran congestión cerca de {location}. Utilice una entrada alternativa y siga las indicaciones del personal.',
    fr: 'Attention : forte affluence près de {location}. Veuillez utiliser une autre entrée et suivre les instructions du personnel.',
    hi: 'कृपया ध्यान दें: {location} के पास अत्यधिक भीड़ है। कृपया वैकल्पिक प्रवेश द्वार का उपयोग करें और स्टाफ के निर्देशों का पालन करें।',
  },
  accessibility_outage: {
    en: 'Accessibility notice: {location} is temporarily out of service. Step-free access is available via the south elevator. Staff can assist at any assistance desk.',
    es: 'Aviso de accesibilidad: {location} está temporalmente fuera de servicio. Hay acceso sin escalones por el ascensor sur. El personal puede ayudarle en cualquier mostrador de asistencia.',
    fr: "Avis d'accessibilité : {location} est temporairement hors service. Un accès sans marches est possible par l'ascenseur sud. Le personnel peut vous aider à tout comptoir d'assistance.",
    hi: 'सुगम्यता सूचना: {location} अस्थायी रूप से सेवा से बाहर है। दक्षिण लिफ्ट से सीढ़ी-रहित पहुंच उपलब्ध है। किसी भी सहायता डेस्क पर स्टाफ आपकी मदद कर सकता है।',
  },
  medical: {
    en: 'Medical assistance is under way near {location}. Please keep aisles clear and follow steward instructions.',
    es: 'Asistencia médica en curso cerca de {location}. Mantenga los pasillos despejados y siga las instrucciones del personal.',
    fr: "Une assistance médicale est en cours près de {location}. Veuillez laisser les allées dégagées et suivre les instructions des stadiers.",
    hi: '{location} के पास चिकित्सा सहायता जारी है। कृपया गलियारे खाली रखें और स्टाफ के निर्देशों का पालन करें।',
  },
  missing_person: {
    en: 'Attention: a young guest is being reunited with their family. If a child approaches you for help, please contact the nearest steward or assistance desk.',
    es: 'Atención: estamos reuniendo a un menor con su familia. Si un niño le pide ayuda, contacte con el asistente o mostrador de ayuda más cercano.',
    fr: "Attention : nous aidons un jeune visiteur à retrouver sa famille. Si un enfant vous demande de l'aide, contactez le stadier ou le comptoir d'assistance le plus proche.",
    hi: 'ध्यान दें: एक बच्चे को उसके परिवार से मिलाया जा रहा है। यदि कोई बच्चा आपसे मदद मांगे, तो कृपया निकटतम स्टाफ या सहायता डेस्क से संपर्क करें।',
  },
  transport_disruption: {
    en: 'Transport update: the metro is experiencing delays. Extra shuttles are running from the shuttle stop near Gate C. Please consider exiting via Gates B or C.',
    es: 'Actualización de transporte: el metro sufre retrasos. Hay lanzaderas adicionales desde la parada cercana a la Puerta C. Considere salir por las puertas B o C.',
    fr: 'Info transport : le métro connaît des retards. Des navettes supplémentaires partent de l’arrêt près de la Porte C. Pensez à sortir par les portes B ou C.',
    hi: 'परिवहन अपडेट: मेट्रो में देरी हो रही है। गेट C के पास शटल स्टॉप से अतिरिक्त शटल चल रही हैं। कृपया गेट B या C से बाहर निकलने पर विचार करें।',
  },
  waste_overflow: {
    en: 'Our cleaning team is attending to {location}. Additional bins are available on the nearby concourse. Thank you for keeping the stadium clean.',
    es: 'Nuestro equipo de limpieza está atendiendo {location}. Hay papeleras adicionales en el vestíbulo cercano. Gracias por mantener limpio el estadio.',
    fr: "Notre équipe d'entretien intervient à {location}. Des poubelles supplémentaires sont disponibles sur le parvis voisin. Merci de garder le stade propre.",
    hi: 'हमारी सफाई टीम {location} पर कार्यरत है। पास के गलियारे में अतिरिक्त कूड़ेदान उपलब्ध हैं। स्टेडियम स्वच्छ रखने के लिए धन्यवाद।',
  },
  weather: {
    en: 'Heat advisory: free water refills are available at all water stations. Shaded rest areas and the quiet room are open. Please stay hydrated.',
    es: 'Aviso de calor: recargas de agua gratuitas en todas las estaciones. Las zonas de sombra y la sala tranquila están abiertas. Manténgase hidratado.',
    fr: "Alerte chaleur : recharges d'eau gratuites à toutes les stations. Les zones ombragées et la salle calme sont ouvertes. Pensez à vous hydrater.",
    hi: 'गर्मी की चेतावनी: सभी वाटर स्टेशनों पर मुफ्त पानी उपलब्ध है। छायादार विश्राम क्षेत्र और शांत कक्ष खुले हैं। कृपया हाइड्रेटेड रहें।',
  },
};

const GENERIC: Template = {
  en: 'Please note: our teams are attending to a situation near {location}. Follow staff guidance and check the app for updates.',
  es: 'Atención: nuestros equipos están atendiendo una situación cerca de {location}. Siga las indicaciones del personal y consulte la aplicación.',
  fr: "Attention : nos équipes interviennent près de {location}. Suivez les instructions du personnel et consultez l'application.",
  hi: 'कृपया ध्यान दें: हमारी टीमें {location} के पास स्थिति संभाल रही हैं। स्टाफ के निर्देशों का पालन करें और ऐप देखते रहें।',
};

export function draftAnnouncementFallback(incident: Incident): {
  title: string;
  translations: AnnouncementTranslation[];
} {
  const template = TEMPLATES[incident.category] ?? GENERIC;
  const location = nodeLabel(incident.locationId);
  return {
    title: `${location}: ${incident.category.replace(/_/g, ' ')} update`,
    translations: fill(template, location),
  };
}
