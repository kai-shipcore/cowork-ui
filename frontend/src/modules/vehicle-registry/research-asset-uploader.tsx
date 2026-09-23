import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
} from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Images,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  PRODUCT_TYPES,
  type ProductTypeId,
  type VehicleConfiguration,
} from '@/shared/types/workbench';
import type { ResearchMaterial } from './vehicle-research-detail-model';
import './research-asset-library.css';

interface ResearchAssetUploaderProps {
  configuration: VehicleConfiguration;
  vehicleLabel?: string;
  targets: readonly ResearchAssetTarget[];
  onSaveMaterials: (
    materials: readonly ResearchMaterial[],
  ) => boolean | Promise<boolean>;
}

export interface ResearchAssetTarget {
  id: string;
  configurationId: string;
  productTypeId: ProductTypeId;
  productLabel: string;
  options: readonly (readonly [string, string])[];
}

interface AssetDraft {
  id: string;
  fileData: string;
  fileName: string;
  fileType: string;
  targetId: string;
  tags: readonly string[];
}

const MAX_BATCH_FILES = 12;
const TARGET_DATA_URL_LENGTH = 260_000;
const GENERAL_TAGS = [
  'Overview',
  'Interior',
  'Exterior',
  'Front',
  'Rear',
  'Detail',
  'Fitment',
  'Dimension',
  'Reference',
] as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('Unable to read image'));
    };
    image.src = url;
  });
}

async function prepareImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Only PNG, JPEG, and WebP images are supported.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let result = canvas.toDataURL('image/jpeg', quality);
    while (result.length > TARGET_DATA_URL_LENGTH && quality > 0.42) {
      quality -= 0.08;
      result = canvas.toDataURL('image/jpeg', quality);
    }
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Sequential batch uploader scoped to one make-model research record. */
export function ResearchAssetUploader({
  configuration,
  vehicleLabel,
  targets,
  onSaveMaterials,
}: ResearchAssetUploaderProps): ReactElement {
  const displayVehicle = vehicleLabel ?? configuration.vehicle;
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<readonly AssetDraft[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [customTag, setCustomTag] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const activeDraft = drafts.find((_, index) => index === activeIndex);
  const activeTarget = targets.find(
    (target) => target.id === activeDraft?.targetId,
  );
  const tagOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(activeTarget
            ? [
                activeTarget.productLabel,
                ...activeTarget.options.map(([, value]) => value),
              ]
            : []),
          ...GENERAL_TAGS,
        ]),
      ),
    [activeTarget],
  );
  const targetGroups = useMemo(
    () =>
      PRODUCT_TYPES.map((productType) => ({
        ...productType,
        targets: targets.filter(
          (target) => target.productTypeId === productType.id,
        ),
      })).filter((group) => group.targets.length > 0),
    [targets],
  );

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      const imageFiles = files
        .filter((file) => file.type.startsWith('image/'))
        .slice(0, Math.max(0, MAX_BATCH_FILES - drafts.length));
      if (!imageFiles.length) {
        setMessage('Paste or select PNG, JPEG, or WebP images.');
        return;
      }
      setOpen(true);
      setMessage(`Preparing ${String(imageFiles.length)} images…`);
      try {
        const prepared = await Promise.all(
          imageFiles.map(async (file, index) => ({
            id: crypto.randomUUID(),
            fileData: await prepareImage(file),
            fileName:
              file.name ||
              `Screenshot ${new Date().toLocaleString()} ${String(index + 1)}.jpg`,
            fileType: 'image/jpeg',
            targetId: '',
            tags: [] as readonly string[],
          })),
        );
        setDrafts((current) => {
          if (!current.length) setActiveIndex(0);
          return [...current, ...prepared];
        });
        setMessage('Select a configuration. Tags are optional.');
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : 'Unable to prepare images.',
        );
      }
    },
    [drafts.length],
  );

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const itemFiles = Array.from(clipboard.items)
        .filter(
          (item) => item.kind === 'file' && item.type.startsWith('image/'),
        )
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
      const files = (
        itemFiles.length ? itemFiles : Array.from(clipboard.files)
      ).filter((file) => file.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      void addFiles(files);
    }
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [addFiles]);

  function updateDraft(id: string, patch: Partial<AssetDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function resetDialog() {
    setDrafts([]);
    setActiveIndex(0);
    setCustomTag('');
    setMessage('');
    setOpen(false);
  }

  function toggleTag(tag: string) {
    if (!activeDraft) return;
    updateDraft(activeDraft.id, {
      tags: activeDraft.tags.includes(tag)
        ? activeDraft.tags.filter((item) => item !== tag)
        : [...activeDraft.tags, tag].slice(0, 30),
    });
  }

  function addCustomTag() {
    const tag = customTag.trim();
    if (!activeDraft || !tag) return;
    updateDraft(activeDraft.id, {
      tags: Array.from(new Set([...activeDraft.tags, tag])).slice(0, 30),
    });
    setCustomTag('');
  }

  function removeDraft(id: string, index: number) {
    const nextLength = Math.max(0, drafts.length - 1);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    setActiveIndex((current) => {
      if (index < current) return current - 1;
      if (current >= nextLength) return Math.max(0, nextLength - 1);
      return current;
    });
    setMessage('');
  }

  async function finishUpload() {
    if (!drafts.length || drafts.some((draft) => !draft.targetId)) {
      setMessage('Select a configuration for every image.');
      return;
    }
    setSaving(true);
    const saved = await onSaveMaterials(
      drafts.map((draft) => {
        const target = targets.find((item) => item.id === draft.targetId);
        if (!target) throw new Error('Research target is missing.');
        return {
          id: draft.id,
          title: draft.fileName,
          sourceUrl: '',
          notes: '',
          tags: [...draft.tags],
          productTypeId: target.productTypeId,
          optionSelections: target.options.map(
            ([key, value]) => [key, value] as [string, string],
          ),
          researchRowId: target.id,
          targetConfigurationId: target.configurationId,
          fileData: draft.fileData,
          fileName: draft.fileName,
          fileType: draft.fileType,
        };
      }),
    );
    setSaving(false);
    if (saved) resetDialog();
    else setMessage('Unable to save assets. Try again.');
  }

  const currentComplete = Boolean(activeDraft?.targetId);
  const isLast = activeIndex === drafts.length - 1;

  return (
    <div className="research-detail-uploader">
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Images aria-hidden="true" /> Add assets
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setOpen(true);
          else resetDialog();
        }}
      >
        <DialogContent className="research-asset-dialog">
          <DialogHeader>
            <DialogTitle>Add research assets</DialogTitle>
            <p>
              {displayVehicle} · Configure each image before moving to the next.
            </p>
          </DialogHeader>

          <DialogBody>
            {!drafts.length ? (
              <label
                className="research-upload-dropzone research-dialog-dropzone"
                onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                }}
                onDrop={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                  void addFiles(Array.from(event.dataTransfer.files));
                }}
              >
                <span className="research-upload-icon">
                  <ClipboardPaste aria-hidden="true" />
                </span>
                <strong>Paste screenshots or drop photos here</strong>
                <span>Up to {MAX_BATCH_FILES} images per batch</span>
                <Button asChild variant="outline">
                  <span>
                    <Upload aria-hidden="true" /> Choose images
                  </span>
                </Button>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    void addFiles(Array.from(event.target.files ?? []));
                    event.target.value = '';
                  }}
                />
              </label>
            ) : (
              <div className="research-asset-wizard">
                <div className="research-asset-wizard-progress">
                  <div>
                    <strong>
                      Asset {activeIndex + 1} of {drafts.length}
                    </strong>
                    <span>{activeDraft?.fileName}</span>
                  </div>
                  <div aria-label="Asset progress">
                    {drafts.map((draft, index) => (
                      <span key={draft.id} className="research-asset-step">
                        <button
                          type="button"
                          className={`research-asset-step-open ${index === activeIndex ? 'active' : ''}`}
                          aria-label={`Open asset ${String(index + 1)}`}
                          onClick={() => {
                            setActiveIndex(index);
                            setMessage('');
                          }}
                        >
                          {draft.targetId ? (
                            <Check aria-hidden="true" />
                          ) : (
                            index + 1
                          )}
                        </button>
                        <button
                          type="button"
                          className="research-asset-step-remove"
                          aria-label={`Remove asset ${String(index + 1)}`}
                          onClick={() => {
                            removeDraft(draft.id, index);
                          }}
                        >
                          <X aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="research-asset-wizard-content">
                  <div className="research-asset-wizard-preview">
                    <img
                      src={activeDraft?.fileData}
                      alt={activeDraft?.fileName}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (activeDraft)
                          removeDraft(activeDraft.id, activeIndex);
                      }}
                    >
                      <Trash2 aria-hidden="true" /> Remove image
                    </Button>
                  </div>

                  <div className="research-asset-wizard-fields">
                    <label>
                      Configuration
                      <select
                        value={activeDraft?.targetId ?? ''}
                        onChange={(event) => {
                          if (!activeDraft) return;
                          updateDraft(activeDraft.id, {
                            targetId: event.target.value,
                          });
                          setMessage('Tags are optional.');
                        }}
                      >
                        <option value="" disabled>
                          Select product and option combination
                        </option>
                        {targetGroups.map((group) => (
                          <optgroup key={group.id} label={group.product}>
                            {group.targets.map((target, index) => (
                              <option key={target.id} value={target.id}>
                                Configuration {index + 1} ·{' '}
                                {target.options.length
                                  ? target.options
                                      .map(([key, value]) => `${key}: ${value}`)
                                      .join(' / ')
                                  : 'Base vehicle'}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    {activeTarget && (
                      <div className="research-wizard-configuration-summary">
                        <strong>{activeTarget.productLabel}</strong>
                        <span>
                          {activeTarget.options.length
                            ? activeTarget.options
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(' · ')
                            : 'Base vehicle'}
                        </span>
                      </div>
                    )}

                    <fieldset disabled={!activeTarget}>
                      <legend>
                        Tags <span>(optional)</span>
                      </legend>
                      <div className="research-wizard-tags">
                        {tagOptions.map((tag) => (
                          <button
                            type="button"
                            key={tag}
                            aria-pressed={activeDraft?.tags.includes(tag)}
                            onClick={() => {
                              toggleTag(tag);
                            }}
                          >
                            {activeDraft?.tags.includes(tag) && (
                              <Check aria-hidden="true" />
                            )}
                            {tag}
                          </button>
                        ))}
                      </div>
                      <div className="research-wizard-custom-tag">
                        <input
                          value={customTag}
                          placeholder="Add custom tag"
                          onChange={(event) => {
                            setCustomTag(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            addCustomTag();
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!customTag.trim()}
                          onClick={addCustomTag}
                        >
                          <Plus aria-hidden="true" /> Add
                        </Button>
                      </div>
                    </fieldset>
                  </div>
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="research-asset-dialog-footer">
            <p role="status">{message}</p>
            <div>
              <Button variant="ghost" onClick={resetDialog}>
                Cancel
              </Button>
              {drafts.length > 0 && activeIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveIndex((current) => current - 1);
                    setMessage('');
                  }}
                >
                  <ArrowLeft aria-hidden="true" /> Back
                </Button>
              )}
              {drafts.length > 0 && (
                <Button
                  variant="primary"
                  disabled={!currentComplete || saving}
                  onClick={() => {
                    if (!isLast) {
                      setActiveIndex((current) => current + 1);
                      setCustomTag('');
                      setMessage('');
                    } else {
                      void finishUpload();
                    }
                  }}
                >
                  {isLast ? (
                    <>
                      <Save aria-hidden="true" />{' '}
                      {saving
                        ? 'Saving…'
                        : `Save ${String(drafts.length)} assets`}
                    </>
                  ) : (
                    <>
                      Next asset <ArrowRight aria-hidden="true" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
