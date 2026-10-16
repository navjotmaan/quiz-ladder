import Image from "next/image";
import LoginButton from "@/components/login";

type TileItem = {
  id: number;
  src: string;
  alt: string;
  /** column position in grid steps */
  x: number;
  /** row position in grid steps (bigger = lower) */
  y: number;
};

const items: TileItem[] = [
  { id: 1, src: "/quiz.png", alt: "Icon 1", x: 0, y: 0 },
  { id: 2, src: "/puzzle-piece.png", alt: "Icon 2", x: 1, y: 1 },
  { id: 3, src: "/quiz (1).png", alt: "Icon 3", x: 2, y: 2 },
  { id: 4, src: "/science.png", alt: "Icon 4", x: 3, y: 1 },
  { id: 5, src: "/trophy.png", alt: "Icon 5", x: 4, y: 0 },
];

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center overflow-x-hidden bg-zinc-100 text-center">
      <main className="flex w-full max-w-7xl flex-col items-center px-4 sm:px-6">
        {/* Header */}
        <header className="flex w-full items-center justify-between px-1 pt-4 sm:px-2 sm:pt-5">
          <p className="text-xl sm:text-2xl">
            <b>Quiz</b>Ladder
          </p>
        </header>

        {/* Heading */}
        <h1 className="max-w-[760px] pt-12 text-3xl font-extrabold leading-tight text-neutral-900 min-[420px]:text-4xl sm:pt-16 sm:text-5xl lg:pt-20 lg:text-6xl">
          Pick Your Topic. Climb the Quiz{" "}
          <span className="rounded-md bg-amber-400 px-2 [box-decoration-break:clone] sm:px-3">
            Ladder.
          </span>
        </h1>

        {/* Sub text */}
        <p className="my-5 max-w-[420px] text-base text-neutral-600 sm:my-6 sm:text-lg">
          Test your knowledge through Beginner, Intermediate, and Advanced rounds to prove how far you can go.
        </p>

        {/* Button */}
        <LoginButton />

        {/* V-shaped isometric tiles
            Sizes scale with the viewport (vw) and are capped at the
            original desktop values, so the group always fits the screen.
            --size   : tile size
            --step-x : horizontal distance between tiles
            --step-y : vertical distance per row (controls the V angle) */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none relative z-0 max-w-full
            [--size:22vw] [--step-x:18vw] [--step-y:10vw]
            md:[--size:min(20vw,220px)] md:[--step-x:min(20.4vw,250px)] md:[--step-y:min(8.9vw,120px)]
            mt-[calc(var(--size)*-0.45)]
            w-[calc(var(--step-x)*4+var(--size))]
            h-[calc(var(--step-y)*2+var(--size))]
            mb-20
          "
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="absolute flex h-[var(--size)] w-[var(--size)] items-center justify-center"
              style={{
                left: `calc(${item.x} * var(--step-x))`,
                top: `calc(${item.y} * var(--step-y))`,
              }}
            >
              {/* diamond platform: rotate the square, then squash it */}
              <span className="absolute inset-0 rounded-[12%] bg-white shadow-[0_30px_40px_rgba(0,0,0,0.08)] [transform:rotateX(60deg)_rotateZ(45deg)]" />

              {/* icon / picture on top of the platform */}
              <Image
                src={item.src}
                alt={item.alt}
                width={120}
                height={120}
                className="relative z-10 h-[calc(var(--size)*0.55)] w-[calc(var(--size)*0.55)] -translate-y-1 object-contain [transform:rotateX(60deg)_rotateZ(-45deg)]"
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}