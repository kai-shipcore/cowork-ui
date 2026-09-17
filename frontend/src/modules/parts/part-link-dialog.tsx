import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@coverland-engineering/ui/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { useNavigate } from 'react-router';
import type { ProductType, ProjectDesign } from '@/shared/types/workbench';
import { usePartLibrary } from './part-library';
import './parts.css';

export function PartLinkDialog({
  product,
  productTypeId,
  zoneId,
  returnTo,
  selectedPart,
  existing,
  onClose,
  onLink,
}: {
  product: ProductType;
  productTypeId: string;
  zoneId: string;
  returnTo: string;
  selectedPart?: string;
  existing: readonly ProjectDesign[];
  onClose: () => void;
  onLink: (design: ProjectDesign) => void;
}) {
  const library = usePartLibrary().filter((p) => p.product === product);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [id, setId] = useState(selectedPart ?? '');
  const part = library.find((p) => p.id === id);
  const [revisionId, setRevisionId] = useState('');
  const revision =
    part?.revisions.find((r) => r.id === revisionId) ??
    part?.revisions[part.revisions.length - 1];
  const [quantity, setQuantity] = useState(1);
  const duplicate = existing.some(
    (d) =>
      d.vehicleProjectId === zoneId &&
      (d.libraryPartId === id || d.name === part?.name),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="part-link-dialog">
        <DialogHeader>
          <DialogTitle>기존 Part 연결</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="part-link-form">
            <label>
              Part 검색
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 / Part Type"
              />
            </label>
            <label>
              Part
              <Select
                value={id}
                onValueChange={(value) => {
                  setId(value);
                  setRevisionId('');
                }}
              >
                <SelectTrigger aria-label="Part 선택"><SelectValue placeholder="연결할 Part를 선택하세요" /></SelectTrigger>
                <SelectContent className="part-link-options" position="popper">
                {library
                  .filter((p) =>
                    `${p.name} ${p.type}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {!library.length && (
              <p>
                등록된 {product} Part가 없습니다. 새 Part를 먼저 생성하세요.
              </p>
            )}
            <label>
              적용 버전
              <Select
                value={revision?.id ?? ''}
                onValueChange={setRevisionId}
                disabled={!part?.revisions.length}
              >
                <SelectTrigger aria-label="적용 버전"><SelectValue placeholder="Part를 먼저 선택하세요" /></SelectTrigger>
                <SelectContent className="part-link-options" position="popper">
                {part?.revisions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    v{r.revisionNumber} · {r.note}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              프로젝트 수량
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <p className="part-link-note">
              선택한 버전이 고정됩니다. 이 차량에서의 피팅은 별도로 확인합니다.
            </p>
            {duplicate && <p role="alert">이미 연결된 Part입니다.</p>}
          </div>
        </DialogBody>
        <DialogFooter className="part-link-footer">
          <Button variant="outline"
            onClick={() =>
              navigate(
                `/parts?${new URLSearchParams({ view: 'create', product, returnTo, zone: new URLSearchParams(returnTo.split('?')[1]).get('zone') ?? 'F' })}`,
              )
            }
          >
            새 Part 만들기
          </Button>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            disabled={
              !part ||
              !revision ||
              duplicate ||
              !Number.isInteger(quantity) ||
              quantity < 1
            }
            onClick={() => {
              if (
                !part ||
                !revision ||
                duplicate ||
                !Number.isInteger(quantity) ||
                quantity < 1
              )
                return;
              onLink({
                id: `DS-${crypto.randomUUID()}`,
                libraryPartId: part.id,
                libraryRevisionId: revision.id,
                productTypeId,
                vehicleProjectId: zoneId,
                name: part.name,
                status: 'ACTIVE',
                quantity,
                details: { ...part.details },
                revisions: [
                  {
                    ...revision,
                    id: `REV-${crypto.randomUUID()}`,
                    sampleApprovedAt: undefined,
                    sampleApprovedBy: undefined,
                  },
                ],
                fittingConfirmed: false,
              });
            }}
          >
            프로젝트에 연결
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
