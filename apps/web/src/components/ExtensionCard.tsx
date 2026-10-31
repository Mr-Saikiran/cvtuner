import { Card } from "./ui";

/** The LinkedIn / Naukri / Indeed integration lives in the browser extension, since those sites can't be read by servers. */
export function ExtensionCard({ compact = false }: { compact?: boolean }) {
  const steps = (
    <ol className="text-muted mt-2 flex list-decimal flex-col gap-1 pl-5 text-xs">
      <li>Download and unzip the extension.</li>
      <li>
        Open <span className="code">chrome://extensions</span> (or <span className="code">edge://extensions</span>) and turn on Developer mode.
      </li>
      <li>Click “Load unpacked” and choose the unzipped folder.</li>
    </ol>
  );
  if (compact) {
    return (
      <p className="text-xs">
        <a className="btn" href="/cvtuner/cvtuner-extension.zip" download>
          Get the CVTuner extension
        </a>{" "}
        <span className="text-muted">adds “Tune with CVTuner” right on LinkedIn, Naukri and Indeed job pages.</span>
      </p>
    );
  }
  return (
    <Card title="LinkedIn, Naukri and Indeed">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[70ch] text-sm">
          <p>
            Install the CVTuner browser extension and every job page on <span className="font-medium">LinkedIn, Naukri and Indeed</span> gets two buttons:
            <span className="font-medium"> Tune with CVTuner</span> brings in the title, company, location and full description, and
            <span className="font-medium"> Save to tracker</span> files the job for later.
          </p>
          <p className="text-muted mt-2 text-xs">
            It reads only the job you are viewing, in your own browser, when you click. Nothing is collected in the background. On a phone, use the share button in
            the LinkedIn, Naukri or Indeed app and pick CVTuner.
          </p>
          {steps}
        </div>
        <a className="btn btn--primary shrink-0" href="/cvtuner/cvtuner-extension.zip" download>
          Download extension
        </a>
      </div>
    </Card>
  );
}
