import { useState } from "react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import NotebooksScreen from "./NotebooksScreen.jsx";
import NotebookWorkspace from "./NotebookWorkspace.jsx";

function App() {
  const [activeNotebook, setActiveNotebook] = useState(null);

  return (
    <>
      <Show when="signed-out">
        <div className="auth-screen">
          <h1>ChaibookLM</h1>
          <p>Sign in to continue</p>
          <div className="auth-buttons">
            <SignInButton />
            <SignUpButton />
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        <header className="topbar">
          <UserButton />
        </header>

        {activeNotebook ? (
          <NotebookWorkspace notebook={activeNotebook} onBack={() => setActiveNotebook(null)} />
        ) : (
          <NotebooksScreen onOpenNotebook={setActiveNotebook} />
        )}
      </Show>
    </>
  );
}

export default App;
