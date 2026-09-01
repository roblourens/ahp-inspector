import type { JSX } from "react";
import type { StateAtResourceMetadata, StateResourceKind } from "../../transport/state-client.js";

export type SelectableStateResourceKind = Exclude<StateResourceKind, "unknown">;
export type SelectableStateResource = StateAtResourceMetadata & {
  readonly kind: SelectableStateResourceKind;
};

interface StateResourceSelectorProps {
  readonly resources: readonly StateAtResourceMetadata[];
  readonly selectedKey: string | null;
  readonly onSelect: (resource: SelectableStateResource) => void;
}

export function isSelectableResource(
  resource: StateAtResourceMetadata,
): resource is SelectableStateResource {
  return resource.kind !== "unknown";
}

export function stateResourceKey(resource: StateAtResourceMetadata): string {
  return `${resource.kind}\u0000${resource.uri}`;
}

export function chooseDefaultResource(
  resources: readonly StateAtResourceMetadata[],
): SelectableStateResource | null {
  const selectable = resources.filter(isSelectableResource);
  return selectable.find((resource) => resource.confidence === "complete") ?? selectable[0] ?? null;
}

export function StateResourceSelector({
  resources,
  selectedKey,
  onSelect,
}: StateResourceSelectorProps): JSX.Element {
  return (
    <fieldset className="state-resource-selector">
      <legend className="state-section-label">Resources</legend>
      <div className="state-resource-list">
        {resources.map((resource) => {
          const key = stateResourceKey(resource);
          const selectable = isSelectableResource(resource);
          const selected = selectable && key === selectedKey;
          const label = `${resource.kind} ${resource.uri} ${resource.confidence} confidence ${resource.diagnosticCount} diagnostics`;

          if (!selectable) {
            return (
              <div
                key={key}
                className="state-resource-option state-resource-option-disabled"
                aria-disabled="true"
              >
                <ResourceLabel resource={resource} />
                <span className="state-resource-unavailable">Unavailable kind</span>
              </div>
            );
          }

          return (
            <button
              key={key}
              type="button"
              className="state-resource-option"
              aria-pressed={selected}
              aria-label={label}
              onClick={() => onSelect(resource)}
            >
              <ResourceLabel resource={resource} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ResourceLabel({ resource }: { readonly resource: StateAtResourceMetadata }): JSX.Element {
  return (
    <>
      <span className="state-resource-main">
        <span className="state-resource-kind">{resource.kind}</span>
        <span className="state-resource-uri">{resource.uri}</span>
      </span>
      <span className="state-resource-meta">
        <span data-confidence={resource.confidence}>{resource.confidence}</span>
        <span>{resource.diagnosticCount} diagnostics</span>
      </span>
    </>
  );
}
