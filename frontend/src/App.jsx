import { useState } from "react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { Sparkles } from "lucide-react";
import NotebooksScreen from "./NotebooksScreen.jsx";
import NotebookWorkspace from "./NotebookWorkspace.jsx";
import { Button } from "@/components/ui/button";

function App() {
  const [activeNotebook, setActiveNotebook] = useState(null);

  return (
    <>
      <Show when="signed-out">
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-center">
          <div className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Sparkles className="h-6 w-6 text-brand-600" />
            ChaibookLM
          </div>
          <p className="text-sm text-slate-500">Sign in to continue</p>
          <div className="flex gap-3">
            <SignInButton>
              <Button variant="outline">Sign in</Button>
            </SignInButton>
            <SignUpButton>
              <Button>Sign up</Button>
            </SignUpButton>
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-brand-600" />
            ChaibookLM
          </div>
          <UserButton />
        </header>

        {activeNotebook ? (
          <NotebookWorkspace
            notebook={activeNotebook}
            onBack={() => setActiveNotebook(null)}
          />
        ) : (
          <NotebooksScreen onOpenNotebook={setActiveNotebook} />
        )}
      </Show>
    </>
  );
}

export default App;
