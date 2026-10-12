import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfPageViewerProps {
  url: string;
  title: string;
}

export function PdfPageViewer({ url, title }: PdfPageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let pdf: Awaited<ReturnType<typeof getDocument>['promise']> | null = null;
    const container = containerRef.current;

    if (!container) return undefined;
    container.replaceChildren();
    setStatus('loading');

    const renderPdf = async () => {
      try {
        const loadingTask = getDocument({ url, disableAutoFetch: false, disableStream: false });
        pdf = await loadingTask.promise;

        if (cancelled) return;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.max(280, (container.clientWidth || 640) - 24);
          const scale = Math.min(availableWidth / baseViewport.width, 2);
          const viewport = page.getViewport({ scale });
          const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'flex justify-center border-b border-border/70 bg-white last:border-b-0';

          const canvas = document.createElement('canvas');
          canvas.setAttribute('aria-label', `${title}, página ${pageNumber}`);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.width = Math.floor(viewport.width * deviceScale);
          canvas.height = Math.floor(viewport.height * deviceScale);
          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);

          await page.render({
            canvasContext: canvas.getContext('2d', { alpha: false })!,
            viewport,
            transform: deviceScale === 1 ? undefined : [deviceScale, 0, 0, deviceScale, 0, 0],
          }).promise;
        }

        if (!cancelled) setStatus('ready');
      } catch (error) {
        if (!cancelled) {
          console.error('No se pudo renderizar el PDF:', error);
          setStatus('error');
        }
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
      if (pdf) void pdf.destroy();
      container.replaceChildren();
    };
  }, [title, url]);

  return (
    <div className="relative max-h-[60vh] min-h-[420px] overflow-y-auto overflow-x-hidden rounded-xl bg-surface-container-low">
      {status === 'loading' && (
        <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-ink-muted">
          Cargando documento…
        </p>
      )}
      {status === 'error' && (
        <p className="flex min-h-[420px] items-center justify-center px-4 text-center text-sm text-destructive">
          No se pudo mostrar el PDF. Usa “Abrir PDF” para verlo en otra pestaña.
        </p>
      )}
      <div ref={containerRef} className="min-w-0 w-full" aria-label={title} />
    </div>
  );
}
