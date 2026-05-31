const workspaceTemplateMagic = 'fractalframe.workspaceTemplate'
const workspaceTemplateVersion = 1
const storageKeyPrefix = 'fractalframe:'
const workspaceTemplatePickerId = 'fractalframe-workspace-template'

type FileSystemWritableFileStreamLike = {
  close: () => Promise<void>
  write: (data: Blob) => Promise<void>
}

type FileSystemFileHandleLike = {
  createWritable?: () => Promise<FileSystemWritableFileStreamLike>
  getFile?: () => Promise<File>
}

type WorkspaceTemplateFilePickerType = {
  accept: Record<string, string[]>
  description: string
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    excludeAcceptAllOption?: boolean
    id?: string
    suggestedName?: string
    types?: WorkspaceTemplateFilePickerType[]
  }) => Promise<FileSystemFileHandleLike>
  showOpenFilePicker?: (options?: {
    excludeAcceptAllOption?: boolean
    id?: string
    multiple?: boolean
    types?: WorkspaceTemplateFilePickerType[]
  }) => Promise<FileSystemFileHandleLike[]>
}

export type WorkspaceTemplatePayload = {
  app: 'FractalFrame_v5'
  createdAt: string
  kind: typeof workspaceTemplateMagic
  localStorage: Record<string, string>
  origin?: string
  version: typeof workspaceTemplateVersion
}

export type WorkspaceTemplateImportResult = {
  keys: number
}

export function createWorkspaceTemplatePayload(): WorkspaceTemplatePayload {
  return {
    app: 'FractalFrame_v5',
    createdAt: new Date().toISOString(),
    kind: workspaceTemplateMagic,
    localStorage: readWorkspaceLocalStorage(),
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    version: workspaceTemplateVersion,
  }
}

export async function saveWorkspaceTemplateFile() {
  const payload = createWorkspaceTemplatePayload()
  const content = JSON.stringify(payload, null, 2)
  const filename = createWorkspaceTemplateFilename(payload.createdAt)
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })

  const pickerWindow = window as SaveFilePickerWindow
  if (pickerWindow.showSaveFilePicker) {
    try {
      const handle = await pickerWindow.showSaveFilePicker({
        excludeAcceptAllOption: false,
        id: workspaceTemplatePickerId,
        suggestedName: filename,
        types: [workspaceTemplatePickerType],
      })
      if (!handle.createWritable) throw new Error('workspace_template_save_handle_invalid')
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return payload
    } catch (error) {
      if (isAbortError(error)) return null
      throw error
    }
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return payload
}

export async function openWorkspaceTemplateFile(): Promise<WorkspaceTemplateImportResult | null> {
  const pickerWindow = window as SaveFilePickerWindow
  if (pickerWindow.showOpenFilePicker) {
    try {
      const handles = await pickerWindow.showOpenFilePicker({
        excludeAcceptAllOption: false,
        id: workspaceTemplatePickerId,
        multiple: false,
        types: [workspaceTemplatePickerType],
      })
      const handle = handles[0]
      if (!handle?.getFile) return null
      const file = await handle.getFile()
      return importWorkspaceTemplateText(await file.text())
    } catch (error) {
      if (isAbortError(error)) return null
      throw error
    }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    input.onchange = () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const result = importWorkspaceTemplateText(String(reader.result ?? ''))
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(reader.error ?? new Error('workspace_template_read_failed'))
      reader.readAsText(file, 'utf-8')
    }
    input.oncancel = () => {
      input.remove()
      resolve(null)
    }
    document.body.appendChild(input)
    input.click()
  })
}

export function importWorkspaceTemplateText(text: string): WorkspaceTemplateImportResult {
  const payload = parseWorkspaceTemplatePayload(text)
  const entries = Object.entries(payload.localStorage).filter(([key, value]) => (
    key.startsWith(storageKeyPrefix) && typeof value === 'string'
  ))
  entries.forEach(([key, value]) => window.localStorage.setItem(key, value))
  return { keys: entries.length }
}

function readWorkspaceLocalStorage() {
  const out: Record<string, string> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !key.startsWith(storageKeyPrefix)) continue
    const value = window.localStorage.getItem(key)
    if (value != null) out[key] = value
  }
  return Object.fromEntries(Object.entries(out).sort(([left], [right]) => left.localeCompare(right)))
}

function parseWorkspaceTemplatePayload(text: string): WorkspaceTemplatePayload {
  const parsed = JSON.parse(text) as Partial<WorkspaceTemplatePayload>
  if (!parsed || parsed.kind !== workspaceTemplateMagic || parsed.version !== workspaceTemplateVersion) {
    throw new Error('workspace_template_invalid_file')
  }
  if (!parsed.localStorage || typeof parsed.localStorage !== 'object' || Array.isArray(parsed.localStorage)) {
    throw new Error('workspace_template_missing_storage')
  }
  return parsed as WorkspaceTemplatePayload
}

function createWorkspaceTemplateFilename(createdAt: string) {
  const stamp = createdAt.replace(/[:.]/g, '-')
  return `fractalframe-workspace-${stamp}.json`
}

const workspaceTemplatePickerType: WorkspaceTemplateFilePickerType = {
  accept: { 'application/json': ['.json'] },
  description: 'FractalFrame workspace template',
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}
