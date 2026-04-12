export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* AI nudge */}
      <div className="h-4 bg-[#E8E4DE] rounded w-4/5" />

      {/* Commitment widget */}
      <div className="h-14 bg-[#E8E4DE] rounded-xl" />

      {/* Members row */}
      <div className="space-y-2">
        <div className="h-3 bg-[#E8E4DE] rounded w-20" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-24 bg-[#E8E4DE] rounded-full" />
          ))}
        </div>
      </div>

      {/* Destination section */}
      <div className="space-y-2">
        <div className="h-3 bg-[#E8E4DE] rounded w-24" />
        <div className="h-20 bg-[#E8E4DE] rounded-xl" />
      </div>
    </div>
  );
}
