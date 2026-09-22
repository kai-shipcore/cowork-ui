import { lazy, Suspense, useEffect, useRef } from 'react';
import { RouteFallback } from '@coverland-engineering/ui/route-fallback';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useLoadingBar } from 'react-top-loading-bar';
import { ROUTES } from '@/constants/routes';
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage';
import { FitmentsPage } from '@/modules/fitments/fitments-page';
import { PartsPage } from '@/modules/parts/parts-page';
import { Layout } from './layout/Layout';

const ProductShapesPage = lazy(() =>
  import('@/modules/product-shapes/product-shapes-page').then((module) => ({
    default: module.ProductShapesPage,
  })),
);

const ShapeDetailPage = lazy(() =>
  import('@/modules/product-shapes/shape-detail-page').then((module) => ({
    default: module.ShapeDetailPage,
  })),
);

const TeamDashboardPage = lazy(() =>
  import('@/modules/dashboard/pages/team-dashboard-page').then((module) => ({
    default: module.TeamDashboardPage,
  })),
);

const OperationsPage = lazy(() =>
  import('@/modules/operations/operations-page').then((module) => ({
    default: module.OperationsPage,
  })),
);

const DevelopmentRequestsPage = lazy(() =>
  import('@/modules/rd-workspace/development-requests-page').then((module) => ({
    default: module.DevelopmentRequestsPage,
  })),
);

const PerformanceDashboardPage = lazy(() =>
  import('@/modules/rd-workspace/performance-dashboard-page').then(
    (module) => ({ default: module.PerformanceDashboardPage }),
  ),
);
const VehicleResearchPage = lazy(() =>
  import('@/modules/vehicle-registry/pages/vehicle-research-page').then(
    (module) => ({ default: module.VehicleResearchPage }),
  ),
);
const VehicleProjectsPage = lazy(() =>
  import('@/modules/product-development/pages/vehicle-projects-page').then(
    (module) => ({ default: module.VehicleProjectsPage }),
  ),
);
const HuntBoardPage = lazy(() =>
  import('@/modules/vehicle-hunt/pages/hunt-board-page').then((module) => ({
    default: module.HuntBoardPage,
  })),
);
const ReworkComplaintsPage = lazy(() =>
  import('@/modules/quality/pages/rework-complaints-page').then((module) => ({
    default: module.ReworkComplaintsPage,
  })),
);
const SamplesPage = lazy(() =>
  import('@/modules/sampling/pages/samples-page').then((module) => ({
    default: module.SamplesPage,
  })),
);
const UniqueVehiclesPage = lazy(() =>
  import('@/modules/product-registry/pages/unique-vehicles-page').then(
    (module) => ({ default: module.UniqueVehiclesPage }),
  ),
);

const ProductCatalogPage = lazy(() =>
  import('@/modules/product-registry/pages/product-catalog-page').then(
    (module) => ({ default: module.ProductCatalogPage }),
  ),
);

const ProductRegistrationsPage = lazy(() =>
  import('@/modules/product-registry/pages/product-registrations-page').then(
    (module) => ({ default: module.ProductRegistrationsPage }),
  ),
);

const VehicleOptionsPage = lazy(() =>
  import('@/modules/reference-data/pages/vehicle-options-page').then(
    (module) => ({ default: module.VehicleOptionsPage }),
  ),
);

const ReferenceDataPage = lazy(() =>
  import('@/modules/reference-data/pages/reference-data-page').then(
    (module) => ({ default: module.ReferenceDataPage }),
  ),
);

const ProfilePage = lazy(() =>
  import('@/modules/profile/pages/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  })),
);

const LoginPage = lazy(() =>
  import('@/modules/auth/pages/login-page').then((module) => ({
    default: module.LoginPage,
  })),
);

export function AppRouter() {
  const { start, complete } = useLoadingBar({
    color: 'var(--color-primary)',
    shadow: false,
    waitingTime: 400,
    transitionTime: 200,
    height: 2,
  });

  const isFirstLoad = useRef(true);
  const location = useLocation();

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    start('static');

    const timer = setTimeout(() => {
      complete();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [complete, location, start]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/development-requests"
          element={
            <Suspense fallback={<RouteFallback />}>
              <DevelopmentRequestsPage />
            </Suspense>
          }
        />
        <Route
          path="/work/:section"
          element={
            <Suspense fallback={<RouteFallback />}>
              <OperationsPage />
            </Suspense>
          }
        />
        <Route
          path="/work/requests/:requestId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <OperationsPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.productShapes}
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductShapesPage />
            </Suspense>
          }
        />
        <Route
          path="/product-shapes/:shapeId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ShapeDetailPage />
            </Suspense>
          }
        />
        <Route path="/parts" element={<PartsPage />} />
        <Route path="/fitments" element={<FitmentsPage />} />
        <Route path="/fitments/:fitmentId" element={<FitmentsPage />} />
        <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        <Route
          path="/dashboard/:teamId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <TeamDashboardPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.performanceDashboard}
          element={
            <Suspense fallback={<RouteFallback />}>
              <PerformanceDashboardPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.vehicleResearch}
          element={
            <Suspense fallback={<RouteFallback />}>
              <VehicleResearchPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.vehicleProjects}
          element={
            <Suspense fallback={<RouteFallback />}>
              <VehicleProjectsPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.huntBoard}
          element={
            <Suspense fallback={<RouteFallback />}>
              <HuntBoardPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.reworkComplaints}
          element={
            <Suspense fallback={<RouteFallback />}>
              <ReworkComplaintsPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.samples}
          element={
            <Suspense fallback={<RouteFallback />}>
              <SamplesPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.uniqueVehicles}
          element={
            <Suspense fallback={<RouteFallback />}>
              <UniqueVehiclesPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.products}
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductCatalogPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.productRegistrations}
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductRegistrationsPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.vehicleOptions}
          element={
            <Suspense fallback={<RouteFallback />}>
              <VehicleOptionsPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.referenceData}
          element={
            <Suspense fallback={<RouteFallback />}>
              <ReferenceDataPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.profileDefault}
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProfilePage />
            </Suspense>
          }
        />
      </Route>
      <Route
        path={ROUTES.login}
        element={
          <Suspense fallback={<RouteFallback />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route
        path="/layout-14"
        element={<Navigate to={ROUTES.dashboard} replace />}
      />
      <Route
        path="*"
        element={<Navigate to={ROUTES.vehicleResearch} replace />}
      />
    </Routes>
  );
}
