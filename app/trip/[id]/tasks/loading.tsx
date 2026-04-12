export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-3 bg-[#E8E4DE] rounded w-16" />
        <div className="h-8 w-20 bg-[#E8E4DE] rounded-lg" />
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((col) => (
          <div key={col} className="space-y-2">
            <div className="h-3 bg-[#E8E4DE] rounded w-20" />
            {[1, 2].map((card) => (
              <div key={card} className="h-24 bg-[#E8E4DE] rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
