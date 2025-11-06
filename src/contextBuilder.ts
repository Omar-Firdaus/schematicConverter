import { ParsedSchematic, ContextJSON, Component, Net, Metadata, Hierarchy, Summary } from './types';
import * as path from 'path';
import * as fs from 'fs';

export class ContextBuilder {
  private parsed: ParsedSchematic;

  constructor(parsed: ParsedSchematic) {
    this.parsed = parsed;
  }

  build(filePath?: string): ContextJSON {
    const metadata = this.buildMetadata(filePath);
    const components = this.buildComponents();
    const nets = this.buildNets();
    const hierarchy = this.buildHierarchy();
    const summary = this.buildSummary(components, nets);

    return {
      metadata,
      components,
      nets,
      hierarchy,
      summary,
    };
  }

  private buildMetadata(filePath?: string): Metadata {
    let title = 'Schematic';
    let author = 'Unknown';
    let revision = '1.0';
    let date = new Date().toISOString().split('T')[0];

    if (filePath) {
      const fileName = path.basename(filePath, path.extname(filePath));
      title = fileName || 'Schematic';

      try {
        const stats = fs.statSync(filePath);
        date = stats.mtime.toISOString().split('T')[0];
      } catch (e) {
      }
    }

    return {
      title,
      author,
      revision,
      date,
    };
  }

  private buildComponents(): Component[] {
    return this.parsed.components.filter(
      (comp) => !comp.id.startsWith('#PWR')
    );
  }

  private buildNets(): Net[] {
    const nets: Map<string, Map<string, Set<string>>> = new Map();

    for (const label of this.parsed.globalLabels) {
      if (!nets.has(label.name)) {
        nets.set(label.name, new Map());
      }

      const nearbyComponents = this.findComponentsNearPoint(label.x, label.y, 50);
      const netConnections = nets.get(label.name)!;
      for (const comp of nearbyComponents) {
        if (!netConnections.has(comp.id)) {
          netConnections.set(comp.id, new Set());
        }
        if (comp.pins) {
          for (const pin of comp.pins) {
            netConnections.get(comp.id)!.add(pin.number);
          }
        }
      }
    }

    for (const wire of this.parsed.wires) {
      if (wire.points.length < 2) continue;

      const startPoint = wire.points[0];
      const endPoint = wire.points[wire.points.length - 1];

      const startComponents = this.findComponentsNearPoint(startPoint.x, startPoint.y, 10);
      const endComponents = this.findComponentsNearPoint(endPoint.x, endPoint.y, 10);

      const startJunction = this.findJunctionAtPoint(startPoint.x, startPoint.y);
      const endJunction = this.findJunctionAtPoint(endPoint.x, endPoint.y);

      const netName = this.generateNetName(wire, startPoint, endPoint);

      if (!nets.has(netName)) {
        nets.set(netName, new Map());
      }

      const netConnections = nets.get(netName)!;

      for (const comp of startComponents) {
        if (!netConnections.has(comp.id)) {
          netConnections.set(comp.id, new Set());
        }
        if (comp.pins) {
          for (const pin of comp.pins) {
            netConnections.get(comp.id)!.add(pin.number);
          }
        }
      }

      for (const comp of endComponents) {
        if (!netConnections.has(comp.id)) {
          netConnections.set(comp.id, new Set());
        }
        if (comp.pins) {
          for (const pin of comp.pins) {
            netConnections.get(comp.id)!.add(pin.number);
          }
        }
      }

      if (startJunction) {
        const connectedWires = this.findWiresAtPoint(startPoint.x, startPoint.y);
        for (const connectedWire of connectedWires) {
          const connectedComponents = this.findComponentsNearPoint(
            connectedWire.points[0].x,
            connectedWire.points[0].y,
            10
          );
          for (const comp of connectedComponents) {
            if (!netConnections.has(comp.id)) {
              netConnections.set(comp.id, new Set());
            }
            if (comp.pins) {
              for (const pin of comp.pins) {
                netConnections.get(comp.id)!.add(pin.number);
              }
            }
          }
        }
      }
    }

    const netArray: Net[] = [];
    for (const [name, componentConnections] of nets.entries()) {
      if (componentConnections.size > 0) {
        const connections: Record<string, string[]> = {};
        for (const [componentId, pinSet] of componentConnections.entries()) {
          if (pinSet.size > 0) {
            connections[componentId] = Array.from(pinSet).sort();
          }
        }
        
        if (Object.keys(connections).length > 0) {
          netArray.push({
            name,
            connections,
          });
        }
      }
    }

    return netArray;
  }

  private findComponentsNearPoint(x: number, y: number, threshold: number): Component[] {
    return this.parsed.components.filter((comp) => {
      const dx = comp.position.x - x;
      const dy = comp.position.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= threshold;
    });
  }

  private findJunctionAtPoint(x: number, y: number, threshold: number = 1): typeof this.parsed.junctions[0] | null {
    for (const junction of this.parsed.junctions) {
      const dx = Math.abs(junction.x - x);
      const dy = Math.abs(junction.y - y);
      if (dx <= threshold && dy <= threshold) {
        return junction;
      }
    }
    return null;
  }

  private findWiresAtPoint(x: number, y: number, threshold: number = 1): typeof this.parsed.wires {
    return this.parsed.wires.filter((wire) => {
      for (const point of wire.points) {
        const dx = Math.abs(point.x - x);
        const dy = Math.abs(point.y - y);
        if (dx <= threshold && dy <= threshold) {
          return true;
        }
      }
      return false;
    });
  }

  private generateNetName(
    wire: typeof this.parsed.wires[0],
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number }
  ): string {
    for (const label of this.parsed.globalLabels) {
      const dx1 = Math.abs(label.x - startPoint.x);
      const dy1 = Math.abs(label.y - startPoint.y);
      const dx2 = Math.abs(label.x - endPoint.x);
      const dy2 = Math.abs(label.y - endPoint.y);

      if ((dx1 < 5 && dy1 < 5) || (dx2 < 5 && dy2 < 5)) {
        return label.name;
      }
    }

    return `NET_${Math.round(startPoint.x)}_${Math.round(startPoint.y)}`;
  }

  private buildHierarchy(): Hierarchy {
    return {
      modules: [],
    };
  }

  private buildSummary(components: Component[], nets: Net[]): Summary {
    return {
      component_count: components.length,
      net_count: nets.length,
    };
  }
}
