// Which person the Chores view is filtered to (null = Everyone). Shared so other views can follow it.
import { people } from './people.svelte';
import type { Person } from '../legacy.svelte';

class PersonFilter {
  id = $state<string | null>(null);

  /** The chosen person, or null for Everyone (also when they've left the people list). */
  get person(): Person | null {
    return people.list.find((p) => p.id === this.id) ?? null;
  }

  select(id: string | null): void {
    this.id = id;
  }

  reset(): void {
    this.id = null;
  }
}

export const personFilter = new PersonFilter();
