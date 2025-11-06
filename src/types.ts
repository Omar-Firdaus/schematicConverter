// s-expression node types
export interface SExprNode {
  type: 'list' | 'atom';
  value?: string | number;
  children?: SExprNode[];
}

// component types
export interface Component {
  id: string;
  type: string;
  value: string;
  footprint: string;
  position: { x: number; y: number };
  pins?: Pin[];
}

// pin connection types
export interface Pin {
  number: string;
  uuid?: string;
}

// net types
export interface Net {
  name: string;
  connections: Record<string, string[]>;
}

// metadata type
export interface Metadata {
  title: string;
  author: string;
  revision: string;
  date: string;
}

// hierarchy type
export interface Module {
  name: string;
  components: string[];
}

// hierarchy type
export interface Hierarchy {
  modules: Module[];
}


// summary type
export interface Summary {
  component_count: number;
  net_count: number;
}

// output JSON structure
export interface ContextJSON {
  metadata: Metadata;
  components: Component[];
  nets: Net[];
  hierarchy: Hierarchy;
  summary: Summary;
}

// parsed schematic data
export interface ParsedSchematic {
  components: Component[];
  wires: Wire[];
  junctions: Junction[];
  globalLabels: GlobalLabel[];
}

// wire type
export interface Wire {
  points: Array<{ x: number; y: number }>;
  uuid?: string;
}

// junction type
export interface Junction {
  x: number;
  y: number;
  uuid?: string;
}

// global label type
export interface GlobalLabel {
  name: string;
  x: number;
  y: number;
  uuid?: string;
}

