export function resolveWorkbenchProfileId() {
  if (typeof window === 'undefined') return 'port-default'
  const port = window.location?.port || 'default'
  const normalized = port.replace(/[^0-9]/g, '') || 'default'
  return `port-${normalized}`
}

export function resolveWorkbenchProfileLabel() {
  const profileId = resolveWorkbenchProfileId()
  return profileId === 'port-default' ? '默认工作区档案' : `工作区档案 ${profileId}`
}
