import React, { useState } from 'react';
import { Share2, Users, FileText, Link as LinkIcon } from 'lucide-react';

interface ShareExamMenuProps {
    examId: string;
    onShareWithGroup: () => void;
    onShareAsGoogleForm: () => void;
    onClose: () => void;
}

const ShareExamMenu: React.FC<ShareExamMenuProps> = ({
    examId,
    onShareWithGroup,
    onShareAsGoogleForm,
    onClose
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleClose = () => {
        setIsOpen(false);
        onClose();
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                <Share2 className="w-5 h-5" />
                Compartir
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <button
                        onClick={() => {
                            onShareWithGroup();
                            handleClose();
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                    >
                        <Users className="w-5 h-5 text-blue-600" />
                        Compartir con Grupo
                    </button>
                    <button
                        onClick={() => {
                            onShareAsGoogleForm();
                            handleClose();
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                    >
                        <FileText className="w-5 h-5 text-green-600" />
                        Compartir como Google Form
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShareExamMenu; 