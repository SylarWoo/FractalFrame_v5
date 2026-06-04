import type { PageDataPackage } from './pageDataTypes'

const pageDataPackages = new Map<string, PageDataPackage>()
const maxPageDataPackages = 16

export const pageDataPackageChangedEvent = 'ff:page-data-package-changed'

function dispatchPageDataPackageChanged(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(pageDataPackageChangedEvent, { detail: { key } }))
  }
}

export function readPageDataPackage(key: string) {
  const entry = pageDataPackages.get(key)
  if (entry) {
    pageDataPackages.delete(key)
    pageDataPackages.set(key, entry)
  }
  return entry ?? null
}

export function writePageDataPackage(entry: PageDataPackage) {
  pageDataPackages.set(entry.key, entry)
  while (pageDataPackages.size > maxPageDataPackages) {
    const oldest = pageDataPackages.keys().next().value
    if (oldest == null) break
    pageDataPackages.delete(oldest)
  }
  dispatchPageDataPackageChanged(entry.key)
  return entry
}

export function updatePageDataPackage(key: string, update: (entry: PageDataPackage) => PageDataPackage) {
  const entry = pageDataPackages.get(key)
  if (!entry) return null
  return writePageDataPackage(update(entry))
}

export function clearPageDataPackages() {
  pageDataPackages.clear()
}
