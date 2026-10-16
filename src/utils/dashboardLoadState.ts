/**
 * When to show dashboard loading vs empty — avoid "No widgets" during fetch.
 */

export type DashboardLoadStateInput = {
  companyReady: boolean;
  accessProfileLoaded: boolean;
  isLoading: boolean;
  isFetching: boolean;
  hasContent: boolean;
};

export type DashboardLoadState = {
  showLoading: boolean;
  showEmpty: boolean;
  title: string;
  subtitle: string;
};

export function resolveDashboardLoadState(
  input: DashboardLoadStateInput,
  labels: { boardName: string; emptyHint: string }
): DashboardLoadState {
  const {
    companyReady,
    accessProfileLoaded,
    isLoading,
    isFetching,
    hasContent,
  } = input;

  if (hasContent) {
    return {
      showLoading: false,
      showEmpty: false,
      title: "",
      subtitle: "",
    };
  }

  if (!companyReady) {
    return {
      showLoading: true,
      showEmpty: false,
      title: accessProfileLoaded
        ? "Preparing dashboard…"
        : "Loading your access profile…",
      subtitle: "Connecting to your ERP company and territory scope.",
    };
  }

  if (isLoading || isFetching) {
    return {
      showLoading: true,
      showEmpty: false,
      title: isLoading ? `Loading ${labels.boardName}…` : "Updating numbers…",
      subtitle: isFetching
        ? "Fetching widgets from the server. This may take a few seconds."
        : "Please wait.",
    };
  }

  return {
    showLoading: false,
    showEmpty: true,
    title: labels.emptyHint,
    subtitle: `Configure the ${labels.boardName} board in Mobile App Profile.`,
  };
}
