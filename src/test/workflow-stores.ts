const stores: { close: () => Promise<void> }[] = [];
export function trackFixtureWorkflowStore(store: {
  close: () => Promise<void>;
}) {
  stores.push(store);
}
export async function closeFixtureWorkflowStores() {
  await Promise.all(stores.splice(0).map((store) => store.close()));
}
