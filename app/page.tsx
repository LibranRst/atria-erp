export default function Home(): React.JSX.Element {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50 mb-2">
          Welcome to Atria ERP
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Finance-first mobile operating system for interior contractors.
        </p>
      </main>
    </div>
  );
}
