export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Tab + button header */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-48 bg-[#E8E4DE] rounded-full" />
        <div className="h-9 w-28 bg-[#E8E4DE] rounded-lg" />
      </div>
      {/* Expense cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-[72px] bg-[#E8E4DE] rounded-xl" />
      ))}
    </div>
  );
}
