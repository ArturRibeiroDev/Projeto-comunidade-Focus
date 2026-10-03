import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { validateAvatar } from '../../services/avatarService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { clampCropOffset } from '../../utils/avatarCrop';

const frameSize = 280;
const outputSize = 512;

export function AvatarUploader({
  name,
  avatarUrl,
  file,
  onFile,
  onRemove,
}: {
  name: string;
  avatarUrl: string;
  file?: File;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [preview, setPreview] = useState('');
  const [source, setSource] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!source) return;
    const picture = new Image();
    picture.onload = () => {
      image.current = picture;
      setDimensions({ width: picture.naturalWidth, height: picture.naturalHeight });
    };
    picture.onerror = () => setError('Não foi possível abrir esta imagem.');
    picture.src = source;
    return () => {
      image.current = null;
      URL.revokeObjectURL(source);
    };
  }, [source]);

  const scale =
    dimensions.width && dimensions.height
      ? Math.max(frameSize / dimensions.width, frameSize / dimensions.height) * zoom
      : 1;
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  const position = {
    x: clampCropOffset(offset.x, width, frameSize),
    y: clampCropOffset(offset.y, height, frameSize),
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setOffset({
      x: clampCropOffset(drag.current.offsetX + event.clientX - drag.current.x, width, frameSize),
      y: clampCropOffset(drag.current.offsetY + event.clientY - drag.current.y, height, frameSize),
    });
  };

  const finish = async () => {
    if (!image.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Não foi possível recortar a imagem.');
      return;
    }
    const ratio = outputSize / frameSize;
    context.drawImage(
      image.current,
      (frameSize / 2 + position.x - width / 2) * ratio,
      (frameSize / 2 + position.y - height / 2) * ratio,
      width * ratio,
      height * ratio,
    );
    let blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.88),
    );
    if (!blob) {
      setError('Não foi possível gerar a imagem.');
      return;
    }
    if (blob.type !== 'image/webp') {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.86),
      );
      if (!blob) {
        setError('Não foi possível gerar a imagem.');
        return;
      }
    }
    const extension =
      blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const cropped = new File([blob], `avatar.${extension}`, {
      type: blob.type,
    });
    try {
      validateAvatar(cropped);
      onFile(cropped);
      setSource('');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Imagem inválida.');
    }
  };

  return (
    <div className="avatar-uploader field-wide">
      {preview || avatarUrl ? (
        <img src={preview || avatarUrl} alt="Avatar atual" />
      ) : (
        <span className="avatar-initials" aria-label="Avatar com iniciais">
          {name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase()}
        </span>
      )}
      <div>
        <strong>Foto do perfil</strong>
        <small>JPEG, PNG ou WebP, até 2 MB.</small>
        <div className="avatar-actions">
          <Button icon={<ImagePlus size={15} />} onClick={() => input.current?.click()}>
            Alterar foto
          </Button>
          <Button icon={<Trash2 size={15} />} onClick={onRemove} variant="ghost">
            Remover
          </Button>
        </div>
        {error && (
          <small className="field-error" role="alert">
            {error}
          </small>
        )}
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Selecionar foto do perfil"
        className="sr-only"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          try {
            validateAvatar(selected);
            setError('');
            setDimensions({ width: 0, height: 0 });
            setOffset({ x: 0, y: 0 });
            setZoom(1);
            setSource(URL.createObjectURL(selected));
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Imagem inválida.');
          }
          event.target.value = '';
        }}
        ref={input}
        type="file"
      />
      <Modal open={Boolean(source)} title="Ajustar foto" onClose={() => setSource('')}>
        <div className="avatar-crop-body">
          <div
            className="avatar-crop-frame"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                offsetX: position.x,
                offsetY: position.y,
              };
            }}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {dimensions.width > 0 && (
              <img
                alt="Prévia do recorte"
                draggable={false}
                src={source}
                style={{
                  width,
                  height,
                  left: (frameSize - width) / 2 + position.x,
                  top: (frameSize - height) / 2 + position.y,
                }}
              />
            )}
          </div>
          <label className="avatar-zoom">
            <span>Zoom</span>
            <input
              aria-label="Zoom da foto"
              max="3"
              min="1"
              onChange={(event) => setZoom(Number(event.target.value))}
              step="0.05"
              type="range"
              value={zoom}
            />
          </label>
          <div className="avatar-crop-actions">
            <Button onClick={() => setSource('')}>Cancelar</Button>
            <Button disabled={!dimensions.width} onClick={() => void finish()} variant="primary">
              Usar foto
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
