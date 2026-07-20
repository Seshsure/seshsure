import { CubeCalc } from "@/components/CubeCalc";
export const dynamic = "force-dynamic";
export default function CubePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <p className="display text-[19px] mt-5" style={{ color: "#181818" }}>CUBE CALCULATOR</p>
      <p className="text-[13px] mt-1" style={{ color: "#3E3A30" }}>
        Ocean freight sells the box, not the weight — every point of cube utilization is straight margin.
        Enter the master carton; see cones per container and what each quote really costs per thousand.
      </p>
      <CubeCalc />
    </div>
  );
}
