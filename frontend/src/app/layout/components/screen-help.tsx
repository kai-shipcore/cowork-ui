import { CircleHelp } from 'lucide-react';
import { useLocation } from 'react-router-dom';

type Guide = { title: string; purpose: string; steps: string[]; check: string };
const guides: Record<string, Guide> = {
  '/dashboard': {
    title: 'Home',
    purpose: 'See overdue work and next actions at a glance.',
    steps: [
      'Find work to review in the summary metrics and alerts.',
      'Open the original project or visit using the item link.',
      'Complete the action there, then return to check the updated status.',
    ],
    check:
      'Unscheduled fittings after sample receipt, unassigned visits, and pending handoffs require different actions.',
  },
  '/vehicle-research': {
    title: 'Vehicle Research',
    purpose: 'Define the vehicles and configurations to develop.',
    steps: [
      'Find vehicles by model year, model, and options.',
      'Review existing research and development status by product.',
      'Check the product and zone, then open the linked project.',
    ],
    check:
      'Vehicles with the same model name may have different fitments depending on seating and options.',
  },
  '/vehicle-projects': {
    title: 'Vehicle Projects',
    purpose:
      'Manage vehicle, product, and zone development from scanning through handoff.',
    steps: [
      'Select a project in the list and confirm its zone.',
      'Check the current stage and next action in Overview.',
      'Visits: Schedule scans and record results. Manage fitting visits here after samples arrive.',
      'Parts: Review the parts being developed and their current revisions.',
      'Samples: Request samples and track shipment, receipt, and approval of the current revision.',
      'Revision Control: Record a new revision and request another sample when inspection or fitting requires changes.',
      'Files: Review required materials. Complete handoff using the documents and checks in the stage checklist.',
      'Activity: Review progress history. After development, review and issue the Shape in the separate Shapes menu.',
    ],
    check:
      'Tabs show a suggested flow; fitting and revisions may repeat. If an action is blocked, check the current zone, revision, required materials, and stage guidance. Shape issuance is not a prerequisite for completing development.',
  },
  '/parts': {
    title: 'Part Management',
    purpose: 'Look up and manage reusable part names and revisions.',
    steps: [
      'Search existing parts by product type and specifications first.',
      'Select the required codes in the generator if a new part is needed.',
      'Review part revisions, change requests, and verification history.',
    ],
    check:
      'A Part is a component; a Shape is the final official number. Creating a part does not automatically link it to the project composition.',
  },
  '/product-shapes': {
    title: 'Shape',
    purpose:
      'Manage official Shape numbers and product compositions after final development review.',
    steps: [
      'Select a project and zone with a completed handoff from the review queue.',
      'Review meeting details, attendees, fitting results, the blueprint, and final parts list, then record approval or rejection.',
      'After approval, issue a Shape or link an eligible existing Shape.',
      'Add part names, revisions, quantities, and the complete blueprint link to the issued Shape, then confirm composition completion.',
    ],
    check:
      'Shape and Size Number refer to the same concept. Document corrections require review; pattern rework restarts with a new sample request in the original project. Issuance and composition completion are separate.',
  },
  '/hunt-board': {
    title: 'Hunt Board',
    purpose:
      'Check vehicle availability and visit preparation for scans and fittings.',
    steps: [
      'Find the target vehicle and project.',
      'Check vehicle availability and visit details.',
      "Record scan and fitting schedules and results in the project's Visits tab.",
    ],
    check:
      'Securing a vehicle is not the same as completing a visit. A booking alone does not complete a scan or fitting.',
  },
  '/samples': {
    title: 'Sample Tracker',
    purpose: 'Track sample requests, shipments, and receipts across projects.',
    steps: [
      'Search by project, factory, or request number.',
      'Use Send Request → Create Shipment → Mark Arrived as each step actually happens.',
      "After receipt, verify and approve the part's current revision in the original project.",
    ],
    check:
      "Shipment arrival is not quality approval. Receiving a previous revision does not satisfy the current revision's requirements.",
  },
  '/unique-vehicles': {
    title: 'Unique Vehicles / F#',
    purpose: 'Review unique vehicle configurations and F# identifiers.',
    steps: [
      'Search vehicles and option combinations.',
      'Review development and product details linked to each zone.',
      'Verify the vehicle configuration to use for product registration.',
    ],
    check:
      'F# and Shape identify different things. Having a number does not mean development is complete for every product.',
  },
  '/products': {
    title: 'Product Catalog',
    purpose: 'Find registered products and SKUs and verify their fitments.',
    steps: [
      'Search by product type or SKU.',
      'Review product status, fitment vehicles, and configurations.',
      'Go to Product Registrations for new registrations and approvals.',
    ],
    check:
      'Development completion, Shape composition completion, and product registration approval are separate statuses.',
  },
  '/product-registrations': {
    title: 'Product Registrations',
    purpose: 'Review and approve product registration requests.',
    steps: [
      'Select a request awaiting approval.',
      'Review the product, SKU, vehicle, and configuration in the request.',
      'Record the review and approve, then check the approved list and Catalog.',
    ],
    check:
      'Shape issuance approval and product registration approval are different. Verify factory delivery and external system updates separately.',
  },
  '/vehicle-options': {
    title: 'Vehicle Options',
    purpose:
      'Manage option definitions used to distinguish vehicle configurations.',
    steps: [
      'Find the option type and existing values.',
      'Check for duplicates and manage the required options.',
      'Confirm consistent usage in vehicle research and projects.',
    ],
    check:
      'These are shared reference values. Use new test values for reviews and assess the impact before changing existing values.',
  },
  '/reference-data': {
    title: 'Reference Data',
    purpose: 'Manage shared codes and reference data for parts and products.',
    steps: [
      'Select the reference data tab to manage.',
      'Search existing codes and names first.',
      'Add required values and verify they are available in the relevant screens.',
    ],
    check:
      'Agree on code meanings and check duplicates first. Shared code changes can affect multiple screens.',
  },
  '/rework-complaints': {
    title: 'Rework / Complaints',
    purpose: 'Review quality issues and rework information.',
    steps: [
      'Find issue records for the vehicle and product.',
      'Check the cause and related project.',
      "If a pattern change is needed, review the original project's revision and sample history.",
    ],
    check:
      'Recording an issue does not automatically restart development. Check the actual stage status.',
  },
  '/profiles/default': {
    title: 'Profile',
    purpose: "Review the current user's information.",
    steps: [
      'Check the displayed user and profile details.',
      "Record the actual reviewer's name separately in review records.",
    ],
    check:
      'The displayed user alone does not verify actual approval permissions.',
  },
};

export function ScreenHelp() {
  const { pathname } = useLocation();
  const guide = guides[pathname];
  if (!guide) return null;
  return (
    <details
      key={pathname}
      className="mt-screen-help mb-4 rounded-lg border border-border bg-background p-3 text-sm"
    >
      <summary className="cursor-pointer font-medium">
        <CircleHelp
          aria-hidden="true"
          className="mr-2 inline-block size-4 text-blue-600"
        />
        {guide.title} Page help
      </summary>
      <div className="mt-3 space-y-3 leading-relaxed">
        <p>{guide.purpose}</p>
        {[
          '/vehicle-research',
          '/vehicle-options',
          '/vehicle-projects',
          '/hunt-board',
          '/samples',
        ].includes(pathname) && (
          <a
            className="block font-medium text-blue-600 underline"
            href="/help/vehicle-to-handoff.html"
            target="_blank"
            rel="noreferrer"
          >
            Step-by-step: Vehicle registration → Options and research → Product
            development and handoff (examples and screenshots)
          </a>
        )}
        {[
          '/product-shapes',
          '/unique-vehicles',
          '/product-registrations',
          '/products',
        ].includes(pathname) && (
          <a
            className="block font-medium text-blue-600 underline"
            href="/help/shape-to-product.html"
            target="_blank"
            rel="noreferrer"
          >
            Step-by-step: Shape → Vehicle fitment → Product registration and
            approval → Catalog (screen guide)
          </a>
        )}
        <ol className="list-decimal space-y-1 pl-5">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="rounded-md bg-muted p-3">
          <strong>Please note: </strong>
          {guide.check}
        </p>
        <a
          className="text-blue-600 underline"
          href="/review-simulation-guide.md"
          download
        >
          Download the team workflow simulation guide
        </a>
        <p className="text-xs text-muted-foreground">
          Review data is stored separately in each browser and is not
          automatically shared with teammates.
        </p>
      </div>
    </details>
  );
}
