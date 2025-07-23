
import MobileWireframe from "@/components/mobile-wireframe";

export default function WireframePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Doobie Division Mobile Wireframe</h1>
          <p className="text-gray-600">Interactive mobile view of the e-commerce and inventory management system</p>
        </div>
        
        <div className="flex justify-center gap-8">
          <div className="relative">
            {/* Phone Frame - Larger Size */}
            <div className="bg-black rounded-[3rem] p-3 shadow-2xl" style={{ transform: 'scale(1.5)' }}>
              <div className="bg-white rounded-[2.5rem] overflow-hidden w-80 h-[600px]">
                <MobileWireframe />
              </div>
            </div>
          </div>
          
          {/* Phone Details - Moved to side */}
          <div className="bg-white p-8 rounded-lg shadow-lg w-80 h-fit">
            <h3 className="font-bold text-xl mb-6">App Features</h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                E-commerce storefront
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Inventory management
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Order tracking
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Analytics dashboard
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                User management
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Role-based access
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Real-time notifications
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Mobile-first design
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm">
            Use the screen selector or bottom navigation to explore different views
          </p>
        </div>
      </div>
    </div>
  );
}
