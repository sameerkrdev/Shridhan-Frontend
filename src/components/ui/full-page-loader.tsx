import { Loader2 } from "lucide-react";

const FullPageLoader = () => {
  return (
    <div className="min-h-svh flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
};

export default FullPageLoader;
