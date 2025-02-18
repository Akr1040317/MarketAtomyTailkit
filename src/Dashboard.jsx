import { useState } from "react";

export default function Dashboard() {
  const [mobileSideContentOpen, setMobileSideContentOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle for Side Content */}
      <div className="w-full bg-gray-50 p-4 lg:hidden lg:p-8 dark:bg-gray-800/25">
        <button
          onClick={() => setMobileSideContentOpen(!mobileSideContentOpen)}
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
        >
          Toggle Side Content
        </button>
      </div>

      {/* Layout */}
      <div className="flex max-w-full flex-auto flex-col lg:flex-row">
        {/* Side Content */}
        <div
          className={`w-full flex-none flex-col bg-gray-50 p-4 lg:flex lg:w-80 lg:p-8 xl:w-96 dark:bg-gray-800/25 ${
            mobileSideContentOpen ? "" : "hidden"
          }`}
        >
          <div className="flex flex-auto items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-64 text-gray-400 dark:border-gray-700 dark:bg-gray-800">
            Dashboard Side Content
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto flex w-full max-w-10xl grow flex-col p-4 lg:p-8">
          <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-64 text-gray-400 dark:border-gray-700 dark:bg-gray-800">
            Dashboard Main Content
          </div>
        </div>
      </div>
    </>
  );
}
