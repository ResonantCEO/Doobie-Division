
import MobileWireframe from "@/components/mobile-wireframe";

export default function WireframePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Doobie Division Mobile Wireframe</h1>
          <p className="text-gray-600">Interactive mobile view of the e-commerce and inventory management system</p>
        </div>
        
        <div className="flex justify-center">
          <div className="relative">
            {/* Phone Frame */}
            <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl">
              <div className="bg-white rounded-[2rem] overflow-hidden">
                <MobileWireframe />
              </div>
            </div>
            
            {/* Phone Details */}
            <div className="absolute -right-64 top-0 bg-white p-6 rounded-lg shadow-lg w-56">
              <h3 className="font-bold text-lg mb-4">App Features</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• E-commerce storefront</li>
                <li>• Inventory management</li>
                <li>• Order tracking</li>
                <li>• Analytics dashboard</li>
                <li>• User management</li>
                <li>• Role-based access</li>
                <li>• Real-time notifications</li>
                <li>• Mobile-first design</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Use the screen selector or bottom navigation to explore different views
          </p>
        </div>
      </div>
    </div>
  );
}
