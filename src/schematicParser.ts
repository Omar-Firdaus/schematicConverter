import { SExpressionParser } from './parser';
import { SExprNode, ParsedSchematic, Component, Wire, Junction, GlobalLabel } from './types';

export class SchematicParser {
  private root: SExprNode;

  constructor(root: SExprNode) {
    this.root = root;
  }

  parse(): ParsedSchematic {
    const components = this.extractComponents();
    const wires = this.extractWires();
    const junctions = this.extractJunctions();
    const globalLabels = this.extractGlobalLabels();

    return {
      components,
      wires,
      junctions,
      globalLabels,
    };
  }

  private extractComponents(): Component[] {
    const components: Component[] = [];

    if (this.root.type !== 'list' || !this.root.children) {
      return components;
    }

    for (const child of this.root.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0 &&
        SExpressionParser.getFirstValue(child) === 'symbol'
      ) {
        const libId = SExpressionParser.findChildValue(child, 'lib_id');
        if (libId) {
          const component = this.parseComponent(child);
          if (component) {
            components.push(component);
          }
        }
      }
    }

    return components;
  }

  private parseComponent(symbolNode: SExprNode): Component | null {
    if (symbolNode.type !== 'list' || !symbolNode.children) {
      return null;
    }

    const libId = SExpressionParser.findChildValue(symbolNode, 'lib_id');
    if (!libId) {
      return null;
    }

    const reference = SExpressionParser.findProperty(symbolNode, 'Reference') || '';
    const value = SExpressionParser.findProperty(symbolNode, 'Value') || '';
    const footprint = SExpressionParser.findProperty(symbolNode, 'Footprint') || '';
    const position = SExpressionParser.extractPosition(symbolNode) || { x: 0, y: 0 };
    const pins = this.extractPins(symbolNode);

    let type = value || 'Unknown';
    if (libId.includes(':')) {
      const parts = libId.split(':');
      if (parts[0] === 'power') {
        type = 'Power';
      } else if (parts[0] === 'Device') {
        const symbolName = parts[1] || '';
        if (symbolName === 'R') {
          type = 'Resistor';
        } else if (symbolName === 'C') {
          type = 'Capacitor';
        } else if (symbolName === 'L') {
          type = 'Inductor';
        } else if (symbolName === 'D') {
          type = 'Diode';
        } else {
          type = symbolName || value || 'Component';
        }
      } else if (parts[0] === 'Transistor_FET') {
        type = 'MOSFET';
      } else if (parts[0] === 'Connector_Generic') {
        type = 'Connector';
      } else {
        type = parts[1] || value || 'Component';
      }
    }

    if (libId.startsWith('power:')) {
      type = value || 'Power';
    }

    return {
      id: reference || 'UNKNOWN',
      type,
      value: value || libId,
      footprint,
      position,
      pins: pins.length > 0 ? pins : undefined,
    };
  }

  private extractPins(symbolNode: SExprNode): Array<{ number: string; uuid?: string }> {
    const pins: Array<{ number: string; uuid?: string }> = [];

    if (symbolNode.type !== 'list' || !symbolNode.children) {
      return pins;
    }

    for (const child of symbolNode.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0 &&
        SExpressionParser.getFirstValue(child) === 'pin'
      ) {
        let pinNumber: string | undefined;
        let uuid: string | undefined;

        if (child.children.length > 1 && child.children[1].type === 'atom') {
          pinNumber = String(child.children[1].value);
        }

        for (const pinChild of child.children) {
          if (
            pinChild.type === 'list' &&
            pinChild.children &&
            pinChild.children.length > 0 &&
            SExpressionParser.getFirstValue(pinChild) === 'uuid'
          ) {
            if (pinChild.children.length >= 2) {
              if (pinChild.children[1].type === 'atom') {
                uuid = String(pinChild.children[1].value);
              } else {
                const uuidParts: string[] = [];
                for (let i = 1; i < pinChild.children.length; i++) {
                  const uuidPart = pinChild.children[i];
                  if (uuidPart.type === 'atom') {
                    uuidParts.push(String(uuidPart.value));
                  }
                }
                if (uuidParts.length > 0) {
                  uuid = uuidParts.join('-');
                }
              }
            }
          }
        }

        if (pinNumber) {
          pins.push({ number: pinNumber, uuid });
        }
      }
    }

    return pins;
  }

  private extractWires(): Wire[] {
    const wires: Wire[] = [];

    if (this.root.type !== 'list' || !this.root.children) {
      return wires;
    }

    for (const child of this.root.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0 &&
        SExpressionParser.getFirstValue(child) === 'wire'
      ) {
        const wire = this.parseWire(child);
        if (wire) {
          wires.push(wire);
        }
      }
    }

    return wires;
  }

  private parseWire(wireNode: SExprNode): Wire | null {
    if (wireNode.type !== 'list' || !wireNode.children) {
      return null;
    }

    const points: Array<{ x: number; y: number }> = [];
    let uuid: string | undefined;

    for (const child of wireNode.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0
      ) {
        const firstValue = SExpressionParser.getFirstValue(child);
        
        if (firstValue === 'pts') {
          for (const ptChild of child.children.slice(1)) {
            if (
              ptChild.type === 'list' &&
              ptChild.children &&
              ptChild.children.length >= 3 &&
              SExpressionParser.getFirstValue(ptChild) === 'xy'
            ) {
              const x = Number(ptChild.children[1]?.type === 'atom' ? ptChild.children[1].value : 0);
              const y = Number(ptChild.children[2]?.type === 'atom' ? ptChild.children[2].value : 0);
              if (!isNaN(x) && !isNaN(y)) {
                points.push({ x, y });
              }
            }
          }
        } else if (firstValue === 'uuid') {
          if (child.children.length >= 2 && child.children[1].type === 'atom') {
            uuid = String(child.children[1].value);
          }
        }
      }
    }

    if (points.length >= 2) {
      return { points, uuid };
    }

    return null;
  }

  private extractJunctions(): Junction[] {
    const junctions: Junction[] = [];

    if (this.root.type !== 'list' || !this.root.children) {
      return junctions;
    }

    for (const child of this.root.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0 &&
        SExpressionParser.getFirstValue(child) === 'junction'
      ) {
        const junction = this.parseJunction(child);
        if (junction) {
          junctions.push(junction);
        }
      }
    }

    return junctions;
  }

  private parseJunction(junctionNode: SExprNode): Junction | null {
    if (junctionNode.type !== 'list' || !junctionNode.children) {
      return null;
    }

    let x: number | undefined;
    let y: number | undefined;
    let uuid: string | undefined;

    for (const child of junctionNode.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0
      ) {
        const firstValue = SExpressionParser.getFirstValue(child);
        
        if (firstValue === 'at') {
          if (child.children.length >= 3) {
            x = Number(child.children[1]?.type === 'atom' ? child.children[1].value : 0);
            y = Number(child.children[2]?.type === 'atom' ? child.children[2].value : 0);
          }
        } else if (firstValue === 'uuid') {
          if (child.children.length >= 2 && child.children[1].type === 'atom') {
            uuid = String(child.children[1].value);
          }
        }
      }
    }

    if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
      return { x, y, uuid };
    }

    return null;
  }

  private extractGlobalLabels(): GlobalLabel[] {
    const labels: GlobalLabel[] = [];

    if (this.root.type !== 'list' || !this.root.children) {
      return labels;
    }

    for (const child of this.root.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0 &&
        SExpressionParser.getFirstValue(child) === 'global_label'
      ) {
        const label = this.parseGlobalLabel(child);
        if (label) {
          labels.push(label);
        }
      }
    }

    return labels;
  }

  private parseGlobalLabel(labelNode: SExprNode): GlobalLabel | null {
    if (labelNode.type !== 'list' || !labelNode.children) {
      return null;
    }

    let name: string | undefined;
    let x: number | undefined;
    let y: number | undefined;
    let uuid: string | undefined;

    if (labelNode.children.length > 1 && labelNode.children[1].type === 'atom') {
      name = String(labelNode.children[1].value);
    }

    for (const child of labelNode.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length > 0
      ) {
        const firstValue = SExpressionParser.getFirstValue(child);
        
        if (firstValue === 'at') {
          if (child.children.length >= 3) {
            x = Number(child.children[1]?.type === 'atom' ? child.children[1].value : 0);
            y = Number(child.children[2]?.type === 'atom' ? child.children[2].value : 0);
          }
        } else if (firstValue === 'uuid') {
          if (child.children.length >= 2 && child.children[1].type === 'atom') {
            uuid = String(child.children[1].value);
          }
        }
      }
    }

    if (name && x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
      return { name, x, y, uuid };
    }

    return null;
  }
}
