"use client";

import "@xyflow/react/dist/base.css";
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow } from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useToast } from "@/components/ui/toast";
import { loadDiagram, saveDiagram } from "@/lib/api/diagram";
import { repoSlug } from "@/lib/api/repositories";
import type { DfdNodeKind, RepositoryAnalysis } from "@/lib/api/types";
import { buildDiagramSvg } from "@/lib/dfd/export-svg";
import {
  GRID, NODE_HEIGHT, NODE_WIDTH, createNode, diagramFromModel, serializeDiagram, toDiagram, toFlowEdge, toFlowEdges, toFlowNodes,
} from "@/lib/dfd/graph";
import type { DfdFlowEdge, DfdFlowNode } from "@/lib/dfd/graph";
import { autoLayout } from "@/lib/dfd/layout";
import { CanvasToolbar } from "./canvas-toolbar";
import { DfdNode } from "./dfd-node";
import { FlowEdge } from "./flow-edge";
import { Inspector } from "./inspector";
import { Toolbox } from "./toolbox";

// Definidos fora do componente: se mudassem a cada render, o React Flow recriava todos os nós.
const nodeTypes = { dfd: DfdNode };
const edgeTypes = { flow: FlowEdge };
const FIT = { padding: 0.12, maxZoom: 1, duration: 200 } as const;
const NODE_KINDS: DfdNodeKind[] = ["external", "process", "store"];

// Cores do fundo em pontos e do minimap, por tema (variáveis CSS que o React Flow lê).
const THEME_VARS = [
  "[--xy-background-pattern-color:#363948]",
  "[.theme-light_&]:[--xy-background-pattern-color:#d0d4e4]",
  "[--xy-minimap-background-color:#1b1e29]",
  "[.theme-light_&]:[--xy-minimap-background-color:#ffffff]",
  "[--xy-attribution-background-color:transparent]",
  "[--xy-minimap-mask-background-color:#10141ccc]",
  "[.theme-light_&]:[--xy-minimap-mask-background-color:#f6f7fccc]",
].join(" ");

type CanvasViewProps = { analysis: RepositoryAnalysis; branch: string };

export function CanvasView(props: CanvasViewProps) {
  // O Provider deixa a barra de ferramentas (fora do <ReactFlow>) usar zoom e viewport.
  return (
    <ReactFlowProvider>
      <CanvasWorkspace {...props} />
    </ReactFlowProvider>
  );
}

function CanvasWorkspace({ analysis, branch }: CanvasViewProps) {
  const router = useRouter();
  const { notify } = useToast();
  const { resolvedTheme } = useTheme();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const initial = useMemo(() => diagramFromModel(analysis.dfd), [analysis.dfd]);
  // useNodesState só usa o valor inicial na primeira vez; depois o estado é do React Flow.
  const [nodes, setNodes, onNodesChange] = useNodesState<DfdFlowNode>(useMemo(() => toFlowNodes(initial), [initial]));
  const [edges, setEdges, onEdgesChange] = useEdgesState<DfdFlowEdge>(useMemo(() => toFlowEdges(initial), [initial]));
  const [savedSerial, setSavedSerial] = useState(() => serializeDiagram(initial));

  // O servidor renderiza o diagrama da análise; no cliente, se houver um guardado, substitui-o.
  // (Ler o localStorage durante o render daria HTML diferente entre servidor e cliente.)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const stored = loadDiagram(analysis.repository);
    if (!stored) return;
    setNodes(toFlowNodes(stored));
    setEdges(toFlowEdges(stored));
    setSavedSerial(serializeDiagram(stored));
    requestAnimationFrame(() => fitView(FIT));
  }, [analysis.repository, fitView, setNodes, setEdges]);

  const diagram = useMemo(() => toDiagram(nodes, edges), [nodes, edges]);
  const dirty = serializeDiagram(diagram) !== savedSerial;
  const selectedNode = nodes.find((n) => n.selected);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      const sourceHandle = connection.sourceHandle === "b" ? "b" : "r";
      const targetHandle = connection.targetHandle === "t" ? "t" : "l";
      const id = `e-${connection.source}-${sourceHandle}-${connection.target}-${targetHandle}`;
      const edge = toFlowEdge({ id, source: connection.source, target: connection.target, sourceHandle, targetHandle, label: "DATA FLOW" });
      setEdges((current) => (current.some((e) => e.id === id) ? current : [...current, edge]));
    },
    [setEdges],
  );

  const place = useCallback(
    (kind: DfdNodeKind, center: { x: number; y: number }) => {
      const node = createNode(kind, { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 }, nodes);
      setNodes((current) => [...current.map((n) => ({ ...n, selected: false })), node]);
    },
    [nodes, setNodes],
  );

  // Clicar num item da toolbox: coloca o nó no centro da zona visível (deslocado para não empilhar).
  function addNode(kind: DfdNodeKind) {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) : { x: 0, y: 0 };
    const offset = (nodes.length % 3) * GRID * 2;
    place(kind, { x: center.x + offset, y: center.y + offset });
    notify("Component added to canvas.");
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    const kind = event.dataTransfer.getData("node-kind") as DfdNodeKind;
    if (!NODE_KINDS.includes(kind)) return;
    place(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  function layout() {
    const laidOut = autoLayout(diagram);
    const positions = new Map(laidOut.nodes.map((n) => [n.id, n.position]));
    setNodes((current) => current.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })));
    // As ligações também mudam de lado (ex.: baixo/cima em vez de direita/esquerda) para acompanhar as novas posições.
    setEdges(laidOut.edges.map(toFlowEdge));
    requestAnimationFrame(() => fitView(FIT));
    notify("Layout updated.");
  }

  function save() {
    if (saveDiagram(analysis.repository, diagram)) {
      setSavedSerial(serializeDiagram(diagram));
      notify("Diagram saved locally.");
    } else {
      notify("Could not save the diagram in this browser.");
    }
  }

  function exportSvg() {
    const svg = buildDiagramSvg(analysis.repository, diagram, resolvedTheme === "light" ? "light" : "dark");
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${analysis.repository.replace("/", "-")}-dfd.svg`;
    link.click();
    URL.revokeObjectURL(url);
    notify("SVG diagram exported.");
  }

  return (
    <div className="canvas-app h-[calc(100vh-72px)]!">
      <CanvasToolbar
        repository={analysis.repository}
        branch={branch}
        dirty={dirty}
        onBack={() => router.push(`/repositories/${repoSlug(analysis.repository)}`)}
        onLayout={layout}
        onSave={save}
        onExport={exportSvg}
      />
      <div className="workspace">
        <Toolbox onAdd={addNode} onConnectorHint={() => notify("Drag from a node's port to another node to connect them.")} />
        <div className="diagram-canvas bg-none!" ref={canvasRef}>
          <div className="absolute inset-0">
            <ReactFlow
              className={THEME_VARS}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={(c) => c.source !== c.target}
              onDrop={onDrop}
              onDragOver={onDragOver}
              snapToGrid
              snapGrid={[GRID, GRID]}
              minZoom={0.5}
              maxZoom={1.5}
              fitView
              fitViewOptions={FIT}
              deleteKeyCode={["Backspace", "Delete"]}
              connectionLineStyle={{ stroke: "#a893ff", strokeWidth: 2 }}
              attributionPosition="top-right"
            >
              <Background variant={BackgroundVariant.Dots} gap={GRID} size={1} bgColor="transparent" />
              <MiniMap
                pannable
                zoomable
                nodeColor="#584d80"
                nodeStrokeColor="#a18be3"
                nodeStrokeWidth={2}
                style={{ width: 125, height: 80 }}
                className="rounded-md! border! border-[#434656]! [.theme-light_&]:border-[#d8d9e5]!"
              />
            </ReactFlow>
          </div>
          <div className="canvas-watermark pointer-events-none z-5">{analysis.repository} <span>/</span> DFD v1.0</div>
          <div className="canvas-bottom-left pointer-events-none z-5"><span className="sr-only">Grid:</span> Dot grid <span>·</span> Snap to grid on</div>
        </div>
        <Inspector node={selectedNode} findings={analysis.findings} />
      </div>
    </div>
  );
}
