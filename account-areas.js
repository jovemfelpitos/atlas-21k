export const areaLabels = {athlete: 'Atleta', coach: 'Treinador', admin: 'Admin dono'};

// The server supplies capabilities. A remembered UI preference never grants access.
export function accountAreas(context, preferred) {
 const areas = Array.isArray(context.areas)
  ? [...new Set(context.areas)].filter(area => Object.hasOwn(areaLabels, area))
  : ['athlete', ...(context.role === 'admin' ? ['admin'] : context.role === 'coach' && context.active ? ['coach'] : [])];
 if (!areas.includes('athlete')) areas.unshift('athlete');
 const wanted = preferred || context.preferred_area || context.role;
 return {areas, selected: areas.includes(wanted) ? wanted : 'athlete', coachStatus: context.coach_status || (context.role === 'coach' ? context.active ? 'active' : 'inactive' : 'none')};
}
