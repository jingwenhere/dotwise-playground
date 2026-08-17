import { DotwiseLab } from "../../components/dotwise-lab";
import "../dotwise/dotwise.css";

export const metadata = {
  title: "Dotwise V4 — White Glass Playground",
  description: "A white canvas Dotwise playground with motion export.",
};

export default function DotwiseV4Page() {
  return <DotwiseLab edition="experimental" chrome="whiteglass" />;
}
