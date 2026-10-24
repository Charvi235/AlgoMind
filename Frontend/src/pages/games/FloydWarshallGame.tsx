import { useState } from "react";
import { generateFloydWarshallGraph } from "../../utils/graphGenerator";

export default function FloydWarshallGame() {
  const [graph] = useState(() => generateFloydWarshallGraph());

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">
        Floyd-Warshall Game
      </h1>

      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-xl mb-4">
          Graph
        </h2>

        <div className="relative w-full h-[600px] border border-slate-700 rounded-lg">
          {graph.nodes.map((node, index) => {
            const angle =
              (2 * Math.PI * index) / graph.nodes.length;

            const x = 50 + 35 * Math.cos(angle);
            const y = 50 + 35 * Math.sin(angle);

            return (
              <div
                key={node.id}
                className="absolute w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center font-bold"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {node.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}