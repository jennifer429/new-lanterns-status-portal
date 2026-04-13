/**
 * WorkflowDiagram Component - Swim Lane Design
 *
 * Interactive swim lane workflow diagram for PACS onboarding
 * Each pathway is a horizontal lane showing: Checkbox → Source → Arrow → Destination → Notes
 *
 * Features:
 * - Swim lane layout: each pathway is a horizontal row
 * - Multi-select: multiple pathways can be active simultaneously
 * - Active state: checked lanes are highlighted in purple with active input fields
 * - Inactive state: unchecked lanes are grayed out with disabled inputs
 * - Supports 4 workflow types: Orders, Images, Priors, Reports Out
 */

import { OrdersWorkflow } from './workflow/OrdersWorkflow';
import { ImagesWorkflow } from './workflow/ImagesWorkflow';
import { PriorsWorkflow } from './workflow/PriorsWorkflow';
import { ReportsWorkflow } from './workflow/ReportsWorkflow';

/**
 * Workflow configuration interface
 */
export interface WorkflowConfiguration {
  paths: {
    [key: string]: boolean;
  };
  systems: {
    [key: string]: string;
  };
  notes: {
    [key: string]: string;
  };
}

interface WorkflowDiagramProps {
  workflowType: 'orders' | 'images' | 'priors' | 'reports';
  configuration: WorkflowConfiguration;
  onConfigurationChange: (config: WorkflowConfiguration) => void;
  validationErrors?: Set<string>; // Set of path IDs that have validation errors
}

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  workflowType,
  configuration,
  onConfigurationChange,
}) => {
  const handleCheckboxChange = (pathKey: string, checked: boolean) => {
    onConfigurationChange({
      ...configuration,
      paths: {
        ...configuration.paths,
        [pathKey]: checked,
      },
    });
  };

  const handleNoteChange = (noteKey: string, value: string) => {
    onConfigurationChange({
      ...configuration,
      notes: {
        ...configuration.notes,
        [noteKey]: value,
      },
    });
  };

  const handleSystemChange = (systemKey: string, value: string) => {
    onConfigurationChange({
      ...configuration,
      systems: {
        ...configuration.systems,
        [systemKey]: value,
      },
    });
  };

  const subProps = {
    configuration,
    onCheckboxChange: handleCheckboxChange,
    onNoteChange: handleNoteChange,
    onSystemChange: handleSystemChange,
  };

  return (
    <div className="space-y-6">
      {workflowType === 'orders' && <OrdersWorkflow {...subProps} />}
      {workflowType === 'images' && <ImagesWorkflow {...subProps} />}
      {workflowType === 'priors' && <PriorsWorkflow {...subProps} />}
      {workflowType === 'reports' && <ReportsWorkflow {...subProps} />}
    </div>
  );
};
