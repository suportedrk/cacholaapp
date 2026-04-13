export default function BILoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-16 h-16 rounded-2xl skeleton-shimmer mb-6" />
      <div className="h-6 w-48 rounded skeleton-shimmer mb-3" />
      <div className="h-4 w-72 rounded skeleton-shimmer" />
    </div>
  )
}
