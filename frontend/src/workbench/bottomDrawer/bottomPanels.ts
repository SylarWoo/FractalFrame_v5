export const bottomPanels = [
  { id: 'strategyTester', label: 'ST', title: 'Strategy Tester', placeholder: 'Strategy tester workspace' },
  { id: 'logs', label: 'Logs', title: 'Logs', placeholder: 'Runtime logs workspace' },
  { id: 'terminal', label: 'Term', title: 'Terminal', placeholder: 'Terminal workspace' },
  { id: 'notes', label: 'Notes', title: 'Notes', placeholder: 'Notes workspace' },
] as const

export type BottomPanelId = (typeof bottomPanels)[number]['id']
