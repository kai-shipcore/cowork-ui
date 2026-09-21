import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { resetPartLibrary } from '@/modules/parts/part-library';
import { useWorkbenchStore } from '@/app/workbench-store';

/** Restores the browser's R&D demo data and part library to the seed after confirmation. */
export function ResetMockDataButton() {
  const [open, setOpen] = useState(false);
  const { resetWorkbench } = useWorkbenchStore();

  function confirmReset(): void {
    resetWorkbench();
    resetPartLibrary();
    setOpen(false);
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        Reset Mock Data
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset mock data</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="dialog-note">
              All R&D data saved in this browser (vehicle research, projects,
              visits, samples, shapes, catalog, reference data) and the part
              library will be replaced with the seed data. Team requests are not
              affected. Export R&D data from Settings first if you need a
              backup.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
