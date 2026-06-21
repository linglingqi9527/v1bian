export function expandMultipartVideos(videos) {
  return videos.flatMap((video) => {
    const pages = Array.isArray(video.pages) ? video.pages : []
    if (pages.length <= 1) return [withSourceKey(video)]
    return pages.map((page) => createPartVideo(video, page))
  })
}

function createPartVideo(video, page) {
  const baseVideo = { ...video }
  delete baseVideo.pages
  const partNumber = Number(page.page ?? 1)
  const sourceKey = `${video.bvid}-p${partNumber}`
  return {
    ...baseVideo,
    cid: Number(page.cid ?? 0),
    description: video.desc ?? video.description ?? '',
    duration: Number(page.duration ?? 0),
    parentTitle: video.title ?? '',
    partNumber,
    sourceKey,
    title: page.part ?? video.title ?? '',
    videoUrl: `https://www.bilibili.com/video/${video.bvid}?p=${partNumber}`,
  }
}

function withSourceKey(video) {
  return {
    ...video,
    sourceKey: video.sourceKey ?? video.bvid,
  }
}
