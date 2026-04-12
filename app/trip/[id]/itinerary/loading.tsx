export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Section header */}
      <div className="h-3 bg-[#E8E4DE] rounded w-16" />

      {/* Day blocks */}
      {[1, 2, 3].map((day) => (
        <div key={day} className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-3 w-10 bg-[#E8E4DE] rounded" />
            <div className="h-4 bg-[#E8E4DE] rounded w-40" />
          </div>
          <div className="ml-12 space-y-2 border-l border-[#E8E4DE] pl-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 bg-[#E8E4DE] rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
