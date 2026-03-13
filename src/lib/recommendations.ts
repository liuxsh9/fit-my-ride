export function getRecommendations(
  avgKnee: number | null,
  avgTorso: number | null,
  avgElbow: number | null
): string[] {
  const recs: string[] = []
  if (avgKnee !== null) {
    if (avgKnee < 140) recs.push('膝盖伸展角度偏小，建议升高坐垫约 5-10mm')
    else if (avgKnee > 150) recs.push('膝盖伸展角度偏大，建议降低坐垫约 5-10mm')
  }
  if (avgTorso !== null) {
    if (avgTorso < 35) recs.push('上体过于前倾，建议调高把立或缩短把立长度')
    else if (avgTorso > 45) recs.push('上体过于直立，建议降低把立或更换更长把立')
  }
  if (avgElbow !== null) {
    if (avgElbow < 150) recs.push('手肘弯曲过多，建议更换更长把立或调整把位')
    else if (avgElbow > 165) recs.push('手肘接近伸直，建议更换更短把立，保持轻微弯曲')
  }
  if (recs.length === 0) recs.push('当前 fitting 状态良好，继续保持！')
  return recs
}
