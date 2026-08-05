/** The real PMCC block, extracted as-is from the company profile. */
export default function Monogram({ className = "h-8" }) {
  return (
    <img
      src="/im/logo.png"
      alt="PMCC"
      width={418}
      height={413}
      className={`${className} w-auto`}
    />
  );
}
