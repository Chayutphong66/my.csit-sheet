import { apiClient, request, useNetlifyFiles } from '@/services/api'

function filenameFromDisposition(disposition) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) return decodeURIComponent(encoded)

  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1]
  return plain ? plain.trim() : ''
}

function downloadResponse(response) {
  return {
    blob: response.data,
    fileName: filenameFromDisposition(response.headers?.['content-disposition'])
  }
}

// Course / subject / sheet retrieval, plus lecture-material retrieval.
export const sheetApi = {
  mine: () => request({ url: '/sheets/mine' }),
  all: () => request({ url: '/sheets/all' }),
  metadata: () => request({ url: '/sheets/metadata' }),
  searchCourses: ({ query, program, year, semester }) => request({ url: `/catalog/courses?q=${encodeURIComponent(query)}&program=${encodeURIComponent(program)}&year=${encodeURIComponent(year)}&semester=${encodeURIComponent(semester)}` }),
  teachers: (courseId, year, semester, program = '') => request({ url: `/catalog/courses/${encodeURIComponent(courseId)}/teachers?year=${encodeURIComponent(year)}&semester=${encodeURIComponent(semester)}&program=${encodeURIComponent(program)}` }),
  suggestTeacher: (data) => request({ url: '/teacher-suggestions', method: 'POST', data }),
  catalog: (type) => request({ url: `/sheets/catalog?type=${encodeURIComponent(type ?? '')}` }),
  // Download an approved sheet's stored file (available to any signed-in user).
  downloadFile: (id) =>
    apiClient.get(useNetlifyFiles ? `/blob/sheet/${encodeURIComponent(id)}/download` : `/sheets/${id}/download`, { responseType: 'blob' }).then(downloadResponse)
}

export const lectureApi = {
  all: () => request({ url: '/lectures' }),
  one: (id) => request({ url: `/lectures/${id}` }),
  // Download an approved lecture's stored file (available to any signed-in user).
  downloadFile: (id) =>
    apiClient.get(useNetlifyFiles ? `/blob/lecture/${encodeURIComponent(id)}/download` : `/lectures/${id}/download`, { responseType: 'blob' }).then(downloadResponse)
}
