import { useMemo } from "react";
import type { RelationshipRecord, SubjectRecord } from "@/domain/types";

interface NodePos {
  id: string;
  x: number;
  y: number;
  name: string;
  shell: boolean;
  score: number;
}

export function NetworkGraph({
  subjects,
  relationships,
  highlightPath,
  onSelect,
  selectedId,
}: {
  subjects: SubjectRecord[];
  relationships: RelationshipRecord[];
  highlightPath?: string[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const { nodes, edges, width, height } = useMemo(() => {
    const width = 640;
    const height = 360;
    const n = Math.max(subjects.length, 1);
    const nodes: NodePos[] = subjects.map((s, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = Math.min(width, height) * 0.36;
      return {
        id: s.id,
        x: width / 2 + Math.cos(angle) * r,
        y: height / 2 + Math.sin(angle) * r,
        name: s.name,
        shell: s.kind === "SHELL_SUSPECT" || s.flags.includes("shell_suspect"),
        score: s.riskScore,
      };
    });
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const edges = relationships
      .filter((r) => byId.has(r.fromSubjectId) && byId.has(r.toSubjectId))
      .map((r) => ({
        id: r.id,
        from: byId.get(r.fromSubjectId)!,
        to: byId.get(r.toSubjectId)!,
        chain: r.relationType === "CHAIN",
        weight: r.weight,
      }));
    // Also draw transaction-derived edges if no relationships yet: pair by shared names via subjects only
    return { nodes, edges, width, height };
  }, [subjects, relationships]);

  const pathSet = new Set(highlightPath ?? []);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full rounded-sm border border-border bg-background"
      role="img"
      aria-label="Malte network graph"
    >
      {edges.map((e) => {
        const hi = pathSet.has(e.from.id) && pathSet.has(e.to.id);
        return (
          <line
            key={e.id}
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
            stroke={hi || e.chain ? "var(--color-accent)" : "var(--color-border)"}
            strokeWidth={hi || e.chain ? 2.5 : 1}
            strokeOpacity={0.85}
          />
        );
      })}
      {nodes.map((node) => {
        const selected = selectedId === node.id;
        const onPath = pathSet.has(node.id);
        return (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            className="cursor-pointer"
            onClick={() => onSelect?.(node.id)}
          >
            <circle
              r={selected || onPath ? 14 : 11}
              fill={
                node.shell
                  ? "color-mix(in oklab, var(--color-destructive) 55%, transparent)"
                  : "color-mix(in oklab, var(--color-elevated) 90%, transparent)"
              }
              stroke={
                node.shell
                  ? "var(--color-destructive)"
                  : selected
                    ? "var(--color-accent)"
                    : "var(--color-border)"
              }
              strokeWidth={selected ? 2 : 1}
            />
            <text
              y={24}
              textAnchor="middle"
              className="fill-[var(--color-muted-foreground)]"
              style={{ fontSize: 9 }}
            >
              {node.name.length > 18 ? `${node.name.slice(0, 16)}…` : node.name}
            </text>
            {node.score > 0 && (
              <text
                y={4}
                textAnchor="middle"
                className="fill-[var(--color-foreground)]"
                style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
              >
                {node.score}
              </text>
            )}
          </g>
        );
      })}
      {nodes.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          className="fill-[var(--color-subtle)]"
          style={{ fontSize: 12 }}
        >
          Import transactions and run detection to populate the graph.
        </text>
      )}
    </svg>
  );
}

/** Shortest path between two subjects on relationship edges (BFS). */
export function findSubjectPath(
  relationships: RelationshipRecord[],
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return [fromId];
  const adj = new Map<string, string[]>();
  for (const r of relationships) {
    if (!r.fromSubjectId || !r.toSubjectId) continue;
    const a = adj.get(r.fromSubjectId) ?? [];
    a.push(r.toSubjectId);
    adj.set(r.fromSubjectId, a);
    const b = adj.get(r.toSubjectId) ?? [];
    b.push(r.fromSubjectId);
    adj.set(r.toSubjectId, b);
  }
  const queue = [fromId];
  const prev = new Map<string, string | null>([[fromId, null]]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === toId) {
        const path: string[] = [];
        let p: string | null = toId;
        while (p) {
          path.push(p);
          p = prev.get(p) ?? null;
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return [];
}
