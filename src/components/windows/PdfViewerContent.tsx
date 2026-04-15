export function PdfViewerContent({ fileUrl }: { fileUrl: string }) {
  return (
    <div className="w-full h-full bg-[#323639] flex items-center justify-center rounded-b-lg overflow-hidden">
      <iframe 
        src={`${fileUrl}#view=FitH&toolbar=0`} 
        className="w-full h-full border-none" 
        title="PDF Viewer"
      />
    </div>
  );
}