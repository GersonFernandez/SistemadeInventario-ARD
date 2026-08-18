export function downloadBlob(response, filename) {
  const blob = response?.data instanceof Blob
    ? response.data
    : new Blob([response?.data ?? []], {
        type: response?.headers?.['content-type'] || 'application/octet-stream',
      })

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    link.remove()
    window.URL.revokeObjectURL(url)
  }, 1000)
}
