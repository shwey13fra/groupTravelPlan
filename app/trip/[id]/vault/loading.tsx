export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-2.5 bg-[#E8E4DE] rounded w-16" />
          <div className="h-2 bg-[#E8E4DE] rounded w-10" />
        </div>
        <div className="h-8 w-28 bg-[#E8E4DE] rounded-lg" />
      </div>

      {/* Toggle row */}
      <div className="h-14 bg-[#E8E4DE] rounded-xl" />

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-[#E8E4DE] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
